package server

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"

	"github.com/sirupsen/logrus"
	"github.com/tritonuas/gcs/internal/cvs"
	"github.com/tritonuas/gcs/internal/influxdb"
	mav "github.com/tritonuas/gcs/internal/mavlink"
	"github.com/tritonuas/gcs/internal/obc"
	"github.com/tritonuas/gcs/internal/protos"
)

// Log is the logger for the server
var Log = logrus.New()

/*
Stores the server state and data that the server deals with.
*/
type Server struct {
	influxDBClient *influxdb.Client
	mavlinkClient  *mav.Client
	obcClient      *obc.Client
	// TODO: reintroduce once this is actually referenced in the code
	// newestRawImage      camera.RawImage
	UnclassifiedTargets []cvs.UnclassifiedODLC `json:"unclassified_targets"`
	MissionTime         int64
	ClassifiedTargets   []cvs.ClassifiedODLC

	MissionConfig *protos.Mission

	IdentifiedTarget []*protos.IdentifiedTarget
	MatchedTarget    []*protos.MatchedTarget
}

/*
We aren't hosting this online, so it's okay to allow requests from all origins to make Houston2's life easier
*/
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func (server *Server) initFrontend(router *gin.Engine) {
	router.Use(static.Serve("/", static.LocalFile("houston", true)))
	router.NoRoute(func(c *gin.Context) {
		c.Redirect(http.StatusTemporaryRedirect, "/index.html")
	})
}

func (server *Server) initBackend(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/connections", server.testConnections())
		api.GET("/influx", server.getInfluxDBtoCSV())
		api.GET("/mission", server.getMission())
		api.POST("/mission", server.postMission())
		api.POST("/airdrop", server.postAirdropTargets())

		path := api.Group("/path")
		{
			path.GET("/initial", server.getInitialPath())
			path.GET("/initial/new", server.getInitialPathNew())
			path.POST("/initial/validate", server.validateInitialPath())
		}

		plane := api.Group("/plane")
		{
			plane.GET("/telemetry/history", server.getTelemetryHistory())
			plane.GET("/telemetry", server.getTelemetry())

			plane.GET("/position/history", server.getPositionHistory())
			plane.GET("/position", server.getPosition())

			plane.GET("/voltage", server.getBatteryVoltages())
		}

		mavlink := api.Group("/mavlink")
		{
			mavlink.GET("/endpoints", server.getMavlinkEndpoints())
			mavlink.PUT("/endpoints", server.putMavlinkEndpoints())
		}

		targets := api.Group("/targets")
		{
			targets.GET("/all", server.getAllTargets())
			targets.GET("/matched", server.getMatchedTargets())
			targets.POST("/matched", server.postMatchedTargets())
		}
	}
}

/*
Initializes all http request routes (tells the server which handler functions to call when a certain route is requested).

General route format is "/place/thing".
*/
func (server *Server) SetupRouter() *gin.Engine {
	router := gin.Default()
	router.Use(CORSMiddleware())

	server.initBackend(router)
	server.initFrontend(router)

	return router
}

// New will initialize a server struct and populate fields with their initial state
func New(influxdbClient *influxdb.Client, mavlinkClient *mav.Client, obcClient *obc.Client) Server {
	server := Server{}

	server.influxDBClient = influxdbClient
	server.mavlinkClient = mavlinkClient
	server.obcClient = obcClient

	server.MissionConfig = nil

	return server
}

/*
Starts the server on localhost:5000. Make sure nothing else runs on port 5000 if you want the plane to fly.
*/
func (server *Server) Start() {
	router := server.SetupRouter()

	err := router.Run(":5000")
	if err != nil {
		// TODO: decide if we want to make this a Log.Fatal and have Hub shutdown
		Log.Errorf("Gin Engine crashed with the following error: %s", err)
	}
}

/*
User testing all of hubs connections. Returns JSON of all the connection statuses.
TODO: Actually test the connections instead of just returning True.
*/
func (server *Server) testConnections() gin.HandlerFunc {
	return func(c *gin.Context) {

		c.JSON(http.StatusOK, gin.H{
			"cvs":             true,
			"plane_obc":       true,
			"plane_mavlink":   server.mavlinkClient.IsConnectedToPlane(),
			"antenna_tracker": server.mavlinkClient.IsConnectedToAntennaTracker()})
	}
}

// getTelemetryHistory gets the telemetry from a certain point in time until now.
// Returns a list of messages. First element in the list is the one at the earliest time.
// Each message JSON has a "_time" key that is the timestamp of that message.
// Use query params to specify the message id or name, time range and message fields.
//
// Example URL: localhost:5000/api/plane/telemetry?id=33&range=5&fields=alt,hdg
//
// Note that only one of ID or name is required. If both are provided, it will
// default to lookup the ID and ignore the name.
//
// URL Params:
//   - id will be the mavlink message ID. Example: 33
//   - name will be the mavlink message name. Example: "GLOBAL_POSITION_INT"
//     A full list of mavlink message names and IDs can be found here
//     http://mavlink.io/en/messages/common.html
//   - range is the number of minutes to look back in the past for a message. Can be a floating point number.
//   - fields are the fields of the mavlink message to return. If none are specified then
//     all the fields are returned. The fields are separated by commas. Example: "alt,hdg"
func (server *Server) getTelemetryHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		msgID := c.Query("id")
		msgName := c.Query("name")
		timeRange := c.Query("range")
		fieldsSeparatedByCommas := c.Query("fields")

		if timeRange == "" {
			c.String(http.StatusBadRequest, "No time range provided")
			return
		}

		timeRangeFloat, err := strconv.ParseFloat(timeRange, 32)
		if err != nil {
			c.String(http.StatusBadRequest, "Non-numerical range provided")
			return
		}

		fields := []string{}
		if fieldsSeparatedByCommas != "" {
			fields = strings.Split(fieldsSeparatedByCommas, ",")
		}

		if msgID != "" {
			msgIDInt, err := strconv.Atoi(msgID)
			if err != nil {
				c.String(http.StatusBadRequest, "Non-numerical message ID requested")
			} else {
				data, err := server.influxDBClient.QueryMsgIDAndFields(uint32(msgIDInt), time.Duration(timeRangeFloat)*time.Minute, fields...)
				if err != nil {
					// TODO: have other types of errors (id does not exist for example)
					c.String(http.StatusInternalServerError, "Error processing database query. Reason: %s", err)
					return
				}

				c.JSON(http.StatusOK, data)
				return
			}
		}

		if msgName != "" {
			data, err := server.influxDBClient.QueryMsgNameAndFields(msgName, time.Duration(timeRangeFloat)*time.Minute, fields...)
			if err != nil {
				// TODO: have other types of errors (name does not exist for example)
				c.String(http.StatusInternalServerError, "Error processing database query. Reason: %s", err)
				return
			}

			c.JSON(http.StatusOK, data)
			return
		}

		c.String(http.StatusBadRequest, "No message name or ID provided")
	}
}

// getTelemetry gets the latest telemetry.
// Use query params to specify the message id, name and message fields.
//
// Example URL: localhost:5000/api/plane/telemetry?id=33&range=5&fields=alt,hdg
//
// Note that only one of ID or name is required. If both are provided, it will
// default to lookup the ID and ignore the name.
//
// URL Params:
//   - id will be the mavlink message ID. Example: 33
//   - name will be the mavlink message name. Example: "GLOBAL_POSITION_INT"
//     A full list of mavlink message names and IDs can be found here
//     http://mavlink.io/en/messages/common.html
//   - fields are the fields of the mavlink message to return. If none are specified then
//     all the fields are returned. The fields are separated by commas. Example: "alt,hdg".
func (server *Server) getTelemetry() gin.HandlerFunc {
	return func(c *gin.Context) {
		msgID := c.Query("id")
		msgName := c.Query("name")
		fieldsSeparatedByCommas := c.Query("fields")

		fields := []string{}
		if fieldsSeparatedByCommas != "" {
			fields = strings.Split(fieldsSeparatedByCommas, ",")
		}

		if msgID != "" {
			msgIDInt, err := strconv.Atoi(msgID)
			if err != nil {
				c.String(http.StatusBadRequest, "Non-numerical message ID requested")
				return
			}

			data, err := server.influxDBClient.QueryMsgIDAndFields(uint32(msgIDInt), 0, fields...)
			if err != nil {
				// TODO: have other types of errors (id does not exist for example)
				c.String(http.StatusInternalServerError, "Error processing database query. Reason: %s", err)
				return
			}

			if len(data) == 0 {
				c.String(http.StatusNotFound, "No telemetry found")
				return
			}

			// only return the 0th index since data will always return a list with a single element if timeRange is 0
			c.JSON(http.StatusOK, data[0])
			return
		}

		if msgName != "" {
			data, err := server.influxDBClient.QueryMsgNameAndFields(msgName, 0, fields...)
			if err != nil {
				// TODO: have other types of errors (name does not exist for example)
				c.String(http.StatusInternalServerError, "Error processing database query. Reason: %s", err)
				return
			}

			if len(data) == 0 {
				c.String(http.StatusNotFound, "No telemetry found")
				return
			}

			c.JSON(http.StatusOK, data[0])
			return
		}

		c.String(http.StatusBadRequest, "No message name or ID provided")
	}
}

// getPositionHistory gets the plane position from a certain point in the past.
// Returns a list of position telemetry.
//
// Matches format of GLOBAL_POSITION_INT mavlink message.
// https://mavlink.io/en/messages/common.html#GLOBAL_POSITION_INT
//
// URL Params:
//   - range is the number of minutes to look back in the past for a message. Can be a floating point number.
func (server *Server) getPositionHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		timeRange := c.Query("range")

		timeRangeFloat, err := strconv.ParseFloat(timeRange, 32)
		if err != nil {
			c.String(http.StatusBadRequest, "Non-numerical range provided")
			return
		}

		data, err := server.influxDBClient.QueryMsgID(33, time.Duration(timeRangeFloat)*time.Minute)
		if err != nil {
			// TODO: have other types of errors (id does not exist for example)
			c.String(http.StatusInternalServerError, "Error processing database query. Reason: %s", err)
			return
		}

		c.JSON(http.StatusOK, data)
	}
}

// getPosition gets the latest plane position.
//
// Matches format of GLOBAL_POSITION_INT mavlink message.
// https://mavlink.io/en/messages/common.html#GLOBAL_POSITION_INT
func (server *Server) getPosition() gin.HandlerFunc {
	return func(c *gin.Context) {
		data, err := server.influxDBClient.QueryMsgID(33, 0)
		if err != nil {
			// TODO: have other types of errors (id does not exist for example)
			c.String(http.StatusInternalServerError, "Error processing database query. Reason: %s", err)
			return
		}

		if len(data) == 0 {
			c.String(http.StatusNotFound, "No telemetry found")
			return
		}

		c.JSON(http.StatusOK, data[0])
	}
}

// getBatteryVoltages retrieves the latest voltage information from the mavlink client
func (server *Server) getBatteryVoltages() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, server.mavlinkClient.LatestBatteryInfo)
	}
}

// getMavlinkEndpoints responds with the mavlink endpoints that Hub is currently
// communicating with. This includes the plane itself and devices that are receiving
// mavlink messages through Hub's mavlink router.
//
// Will return an error if the plane endpoint has not been created yet.
func (server *Server) getMavlinkEndpoints() gin.HandlerFunc {
	return func(c *gin.Context) {
		planeEndpoint, err := server.mavlinkClient.GetPlaneEndpoint()
		if err != nil {
			c.String(http.StatusNotFound, err.Error())
			return
		}
		routerEndpoints := server.mavlinkClient.GetRouterEndpoints()
		endpointData := mav.EndpointData{
			Plane:  planeEndpoint,
			Router: routerEndpoints,
		}
		c.JSON(http.StatusOK, endpointData)
	}
}

// putMavlinkEndpoints will update the plane and router mavlink endpoints.
//
// The JSON body should match the mav.EndpointData struct.
//
// Example body:
//
//	{
//			"plane": "serial:/dev/ttyUSB0",
//			"router": [
//						"udp:192.168.1.7:14551",
//						"tcp:localhost:14550"
//					  ]
//	}
func (server *Server) putMavlinkEndpoints() gin.HandlerFunc {
	return func(c *gin.Context) {
		endpointData := mav.EndpointData{}
		err := c.BindJSON(&endpointData)
		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
			return
		}

		server.mavlinkClient.UpdateEndpoints(endpointData.Plane, endpointData.Router)
		c.String(http.StatusOK, "Updated mavlink endpoints")
	}
}

func (server *Server) getMission() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.MissionConfig == nil {
			c.String(http.StatusBadRequest, "Mission not found")
		}

		c.JSON(http.StatusOK, server.MissionConfig)
	}
}

func (server *Server) postMission() gin.HandlerFunc {
	return func(c *gin.Context) {
		mission := protos.Mission{}
		err := c.BindJSON(&mission)
		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
		}

		server.MissionConfig = &mission

		respBody, status := server.obcClient.PostMission(&mission)
		c.Data(status, "text/plain", respBody)
	}
}

func (server *Server) postAirdropTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.String(http.StatusNotImplemented, "Not Implemented")
	}
}

func (server *Server) getInitialPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, httpStatus := server.obcClient.GetCurrentInitialPath()
		if httpStatus != http.StatusOK {
			c.String(httpStatus, "Error getting current initial path: %s", body)
			return
		}

		c.Data(http.StatusOK, "application/json", body)
	}
}

func (server *Server) getInitialPathNew() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, httpStatus := server.obcClient.GenerateNewInitialPath()
		if httpStatus != http.StatusOK {
			c.String(httpStatus, "Error generating new initial path: %s", body)
			return
		}

		c.Data(http.StatusOK, "text/plain", body)
	}
}

func (server *Server) validateInitialPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, httpStatus := server.obcClient.ValidateInitialPath()
		if httpStatus != http.StatusOK {
			c.String(httpStatus, "Error validating new path: %s", body)
			return
		}

		c.Data(http.StatusOK, "application/json", body)
	}
}

/*
Calls GetAll function in influxDB client to dump influx data into csv files.
*/
func (server *Server) getInfluxDBtoCSV() gin.HandlerFunc {
	return func(c *gin.Context) {
		success, err := server.influxDBClient.GetAll()
		if err != nil {
			c.JSON(http.StatusBadRequest, err.Error())
		} else {
			c.JSON(http.StatusOK, success)
		}
	}
}

func (server *Server) getAllTargets() gin.HandlerFunc {
	var base64Data = "data:image/png;base64,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"
	var base64Data2 = "data:image/png;base64,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"
	if len(server.IdentifiedTarget) == 0 {
		server.IdentifiedTarget = append(server.IdentifiedTarget, &protos.IdentifiedTarget{
			Id:      1,
			Picture: base64Data,
			Coordinate: &protos.GPSCoord{
				Latitude:  1.3915,
				Longitude: 103.8894,
				Altitude:  0,
			},
			Alphanumeric:      "A",
			AlphanumericColor: protos.ODLCColor_Red,
			Shape:             protos.ODLCShape_Circle,
			ShapeColor:        protos.ODLCColor_Orange,
			IsMannikin:        false,
		})
		server.IdentifiedTarget = append(server.IdentifiedTarget, &protos.IdentifiedTarget{
			Id:      2,
			Picture: base64Data,
			Coordinate: &protos.GPSCoord{
				Latitude:  1.3915,
				Longitude: 103.8994,
				Altitude:  0,
			},
			AlphanumericColor: protos.ODLCColor_Blue,
			Alphanumeric:      "B",
			Shape:             protos.ODLCShape_Circle,
			ShapeColor:        protos.ODLCColor_Green,
			IsMannikin:        false,
		})
		server.IdentifiedTarget = append(server.IdentifiedTarget, &protos.IdentifiedTarget{
			Id:      3,
			Picture: base64Data,
			Coordinate: &protos.GPSCoord{
				Latitude:  1.3915,
				Longitude: 103.8794,
				Altitude:  0,
			},
			AlphanumericColor: protos.ODLCColor_Green,
			Alphanumeric:      "C",
			Shape:             protos.ODLCShape_Circle,
			ShapeColor:        protos.ODLCColor_Purple,
			IsMannikin:        false,
		})
		server.IdentifiedTarget = append(server.IdentifiedTarget, &protos.IdentifiedTarget{
			Id:      4,
			Picture: base64Data,
			Coordinate: &protos.GPSCoord{
				Latitude:  1.3915,
				Longitude: 103.8694,
				Altitude:  0,
			},
			AlphanumericColor: protos.ODLCColor_Purple,
			Alphanumeric:      "D",
			Shape:             protos.ODLCShape_Circle,
			ShapeColor:        protos.ODLCColor_Red,
			IsMannikin:        false,
		})
		server.IdentifiedTarget = append(server.IdentifiedTarget, &protos.IdentifiedTarget{
			Id:      5,
			Picture: base64Data,
			Coordinate: &protos.GPSCoord{
				Latitude:  1.3915,
				Longitude: 103.8594,
				Altitude:  0,
			},
			AlphanumericColor: protos.ODLCColor_Orange,
			Alphanumeric:      "E",
			Shape:             protos.ODLCShape_Circle,
			ShapeColor:        protos.ODLCColor_Blue,
			IsMannikin:        false,
		})

		for i := 6; i < 11; i++ {
			server.IdentifiedTarget = append(server.IdentifiedTarget, &protos.IdentifiedTarget{
				Id:      int32(i),
				Picture: base64Data2,
				Coordinate: &protos.GPSCoord{
					Latitude:  1.3915,
					Longitude: 103.8894,
					Altitude:  0,
				},
				AlphanumericColor: protos.ODLCColor_Orange,
				Alphanumeric:      "E",
				Shape:             protos.ODLCShape_Circle,
				ShapeColor:        protos.ODLCColor_Blue,
				IsMannikin:        false,
			})
		}
	}
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, server.IdentifiedTarget)
	}
}

func (server *Server) getMatchedTargets() gin.HandlerFunc {
	if len(server.MatchedTarget) == 0 {
		server.MatchedTarget = append(server.MatchedTarget, &protos.MatchedTarget{
			Bottle: &protos.Bottle{
				Alphanumeric:      "A",
				AlphanumericColor: protos.ODLCColor_Red,
				Shape:             protos.ODLCShape_Circle,
				ShapeColor:        protos.ODLCColor_Orange,
				Index:             protos.BottleDropIndex_A,
				IsMannikin:        true,
			},
			Target: server.IdentifiedTarget[0],
		})
		server.MatchedTarget = append(server.MatchedTarget, &protos.MatchedTarget{
			Bottle: &protos.Bottle{
				Alphanumeric:      "B",
				AlphanumericColor: protos.ODLCColor_Red,
				Shape:             protos.ODLCShape_Circle,
				ShapeColor:        protos.ODLCColor_Orange,
				Index:             protos.BottleDropIndex_B,
				IsMannikin:        false,
			},
			Target: server.IdentifiedTarget[1],
		})
		server.MatchedTarget = append(server.MatchedTarget, &protos.MatchedTarget{
			Bottle: &protos.Bottle{
				Alphanumeric:      "C",
				AlphanumericColor: protos.ODLCColor_Red,
				Shape:             protos.ODLCShape_Circle,
				ShapeColor:        protos.ODLCColor_Orange,
				Index:             protos.BottleDropIndex_C,
				IsMannikin:        false,
			},
			Target: server.IdentifiedTarget[2],
		})
		server.MatchedTarget = append(server.MatchedTarget, &protos.MatchedTarget{
			Bottle: &protos.Bottle{
				Alphanumeric:      "D",
				AlphanumericColor: protos.ODLCColor_Red,
				Shape:             protos.ODLCShape_Circle,
				ShapeColor:        protos.ODLCColor_Orange,
				Index:             protos.BottleDropIndex_D,
				IsMannikin:        false,
			},
			Target: server.IdentifiedTarget[3],
		})
		server.MatchedTarget = append(server.MatchedTarget, &protos.MatchedTarget{
			Bottle: &protos.Bottle{
				Alphanumeric:      "E",
				AlphanumericColor: protos.ODLCColor_Red,
				Shape:             protos.ODLCShape_Circle,
				ShapeColor:        protos.ODLCColor_Orange,
				Index:             protos.BottleDropIndex_E,
				IsMannikin:        false,
			},
			Target: server.IdentifiedTarget[4],
		})
	}
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, server.MatchedTarget)
	}
}

func (server *Server) postMatchedTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		var matchedTargets []*protos.MatchedTarget
		err := c.BindJSON(&matchedTargets)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		// Clear the current MatchedTarget slice
		server.MatchedTarget = []*protos.MatchedTarget{}

		// Append the matchedTargets to the server's MatchedTarget slice
		server.MatchedTarget = append(server.MatchedTarget, matchedTargets...)

		// Return a success response
		c.JSON(http.StatusCreated, gin.H{"message": "MatchedTargets added successfully"})
	}
}
