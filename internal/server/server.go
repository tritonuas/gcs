package server

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
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

	MissionConfig   *protos.Mission
	reportFileMutex sync.Mutex
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

// Refer to
// https://docs.google.com/document/d/1lC3JeaoQpAlVzV6pz506_U3zUBMEk0cjplOshf_CMKw/edit?tab=t.0
func (server *Server) initBackend(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/connections", server.testConnections())
		api.GET("/obc_connection", server.testOBCConnection())
		api.GET("/influx", server.getInfluxDBtoCSV())
		api.GET("/mission", server.getMission())
		api.POST("/mission", server.postMission())
		api.GET("/report", server.getSavedTargets())
		api.POST("/report", server.pushSavedTargets())

		api.GET("/camera/capture", server.doCameraCapture())

		takeoff := api.Group("/takeoff")
		{
			takeoff.POST("/autonomous", server.doAutonomousTakeoff())
			takeoff.POST("/manual", server.doManualTakeoff())
		}

		path := api.Group("/path")
		{
			path.GET("/initial", server.getInitialPath())
			path.GET("/coverage", server.getCoveragePath())
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

			plane.POST("/dodropnow", server.doAirdropNow())
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

			targets.POST("/locations", server.postAirdropTargets())

			targets.POST("/validate", server.validateTargets())
			targets.POST("/reject", server.rejectTargets())
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

func (server *Server) testOBCConnection() gin.HandlerFunc {
	return func(c *gin.Context) {
		var obcStatusBytes []byte

		resp, status := server.obcClient.GetConnectionInfo()
		if status != http.StatusOK {
			obcStatusBytes = []byte("{}")
		} else {
			obcStatusBytes = resp
		}

		c.Data(http.StatusOK, "application/json", obcStatusBytes)
	}
}

/*
User testing all of hubs connections. Returns JSON of all the connection statuses.
TODO: Actually test the connections instead of just returning True.
*/
func (server *Server) testConnections() gin.HandlerFunc {
	return func(c *gin.Context) {

		obcConnected, _ := server.obcClient.IsConnected()

		c.JSON(http.StatusOK, gin.H{
			"radio_mavlink":   server.mavlinkClient.IsConnectedToPlane(),
			"plane_obc":       obcConnected,
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
		airdropTarget := []protos.AirdropTarget{}
		err := c.BindJSON(&airdropTarget)
		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
		}

		respBody, status := server.obcClient.PostAirdropTargets(&airdropTarget)
		c.String(status, "text/plain", respBody)
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

func (server *Server) getCoveragePath() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, httpStatus := server.obcClient.GetCoveragePath()
		if httpStatus != http.StatusOK {
			c.String(httpStatus, "Error getting current coverage path: %s", body)
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
	return func(c *gin.Context) {
		data, err := server.obcClient.GetIdentifiedTargets()
		if err != http.StatusOK {
			c.Data(err, "text/plain", data)
		} else {
			c.Data(http.StatusOK, "application/json", data)
		}
	}
}

func (server *Server) getMatchedTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		data, err := server.obcClient.GetMatchedTargets()
		if err != http.StatusOK {
			c.Data(err, "text/plain", data)
		} else {
			c.Data(http.StatusOK, "application/json", data)
		}
	}
}

func (server *Server) postMatchedTargets() gin.HandlerFunc {
	return func(c *gin.Context) {

		jsonData, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.String(http.StatusBadRequest, "cant read body")
			return
		}

		str := string(jsonData)
		fmt.Println("JSON IS")
		fmt.Println(str)

		body, code := server.obcClient.PostTargetMatchOverride(jsonData)
		if code != http.StatusOK {
			c.Data(code, "text/plain", body)
		} else {
			c.JSON(code, body)
		}
	}
}

func (server *Server) doAirdropNow() gin.HandlerFunc {
	return func(c *gin.Context) {
		var airdrop protos.AirdropSwap
		err := c.BindJSON(&airdrop)
		if err != nil {
			c.String(http.StatusBadRequest, "Malformed bottle index")
		}

		body, status := server.obcClient.DoDropNow(&airdrop)
		c.Data(status, "text/plain", body)
	}
}

func (server *Server) doAutonomousTakeoff() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, status := server.obcClient.DoAutonomousTakeoff()
		c.Data(status, "text/plain", body)
	}
}

func (server *Server) doManualTakeoff() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, status := server.obcClient.DoManualTakeoff()
		c.Data(status, "text/plain", body)
	}
}

func (server *Server) doCameraCapture() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, status := server.obcClient.DoCameraCapture()
		c.Data(status, "application/json", body)
	}
}

func (server *Server) validateTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, status := server.obcClient.ValidateTargets()
		c.Data(status, "application/json", body)
	}
}

func (server *Server) rejectTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, status := server.obcClient.RejectTargets()
		c.Data(status, "application/json", body)
	}
}

// Also I think this dir is gonna save the json in the gcs/internal/server directory so plz change this to smth more reasonable
const reportJson = "saved/targets.json"

// Comments for Kimi:
// - GET request; should return JSON in the HTTP Response body
func (s *Server) getSavedTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		s.reportFileMutex.Lock()
		defer s.reportFileMutex.Unlock()

		fileBytes, err := os.ReadFile(reportJson) // This might error if "/saved" doesn't exist so might want to modify reportJson
		
		// If error reading OR file is empty, send an empty JSON array
		if err != nil || len(fileBytes) == 0 {
			emptyJsonPayload := []byte("[]") // Send empty array
			c.Data(http.StatusOK, "application/json", emptyJsonPayload)
			return
		}

		c.Data(http.StatusOK, "application/json", fileBytes)
	}
}

// - POST request; Expects JSON in body
func (s *Server) pushSavedTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		jsonData, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.String(http.StatusBadRequest, "cant read body")
			return
		}

		s.reportFileMutex.Lock()
		defer s.reportFileMutex.Unlock()

		// Create the directory if it doesn't exist
		if err := os.MkdirAll("saved", 0755); err != nil {
			c.String(http.StatusInternalServerError, "Failed to create directory: %v", err)
			return
		}

		err = os.WriteFile(reportJson, jsonData, 0666)
		if err != nil {
			c.String(http.StatusBadRequest, "Cant Write Json: %v", err)
			return
		}

		c.Data(http.StatusOK, "text/plain", nil)
	}
}
