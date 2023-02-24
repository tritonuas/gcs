package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"

	"github.com/sirupsen/logrus"
	"github.com/tritonuas/gcs/internal/cvs"
	"github.com/tritonuas/gcs/internal/influxdb"
	"github.com/tritonuas/gcs/internal/manager"
	mav "github.com/tritonuas/gcs/internal/mavlink"
	"github.com/tritonuas/gcs/internal/obc/airdrop"
	"github.com/tritonuas/gcs/internal/obc/pp"
)

// Log is the logger for the server
var Log = logrus.New()

/*
Stores the server state and data that the server deals with.
*/
type Server struct {
	influxDBClient      *influxdb.Client
	mavlinkClient       *mav.Client
	UnclassifiedTargets []cvs.UnclassifiedODLC `json:"unclassified_targets"`
	Bottles             *airdrop.Bottles
	MissionTime         int64
	Mission             *pp.Mission
	InitialPath         []pp.Waypoint
	ClassifiedTargets   []cvs.ClassifiedODLC
	Manager             *manager.Manager
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
	router.Use(static.Serve("/", static.LocalFile("static", false)))

	router.NoRoute(func(c *gin.Context) {
		c.Redirect(http.StatusTemporaryRedirect, "/404.html")
	})
}

func (server *Server) initBackend(router *gin.Engine) {
	api := router.Group("/api")
	{
		api.GET("/connections", server.testConnections())

		obc := api.Group("/obc")
		{
			obc.POST("/targets", server.postOBCTargets())
		}

		hub := api.Group("/hub")
		{
			hub.GET("/time", server.getTimeElapsed())
			hub.POST("/time", server.startMissionTimer())

			hub.GET("/state", server.getState())
			hub.POST("/state", server.changeState())
			hub.GET("/state/time", server.getStateStartTime())
			hub.GET("/state/history", server.getStateHistory())
		}

		plane := api.Group("/plane")
		{
			plane.POST("/airdrop", server.uploadDropOrder())
			plane.GET("/airdrop", server.getDropOrder())
			plane.PATCH("/airdrop", server.updateDropOrder())

			plane.GET("/telemetry/history", server.getTelemetryHistory())
			plane.GET("/telemetry", server.getTelemetry())

			plane.GET("/position/history", server.getPositionHistory())
			plane.GET("/position", server.getPosition())

			plane.GET("/voltage", server.getBatteryVoltages())

			plane.GET("/path/initial", server.getInitialPath())     // Houston to Hub
			plane.POST("/path/initial", server.uploadInitialPath()) // OBC to Hub

			plane.POST("/generatepath", server.generateInitialPath()) // Houston to Hub
		}

		mission := api.Group("/mission")
		{
			mission.GET("/bounds/flight", server.getFlightBounds())
			mission.POST("/bounds/flight", server.uploadFlightBounds())

			mission.GET("/bounds/search", server.getSearchBounds())
			mission.POST("/bounds/search", server.uploadSearchBounds())
		}

		cvs := api.Group("/cvs")
		{
			cvs.POST("/targets", server.postCVSResults())
			cvs.GET("/targets", server.getStoredCVSResults())
		}

		mavlink := api.Group("/mavlink")
		{
			mavlink.GET("/endpoints", server.getMavlinkEndpoints())
			mavlink.PUT("/endpoints", server.putMavlinkEndpoints())

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

	server.initFrontend(router)
	server.initBackend(router)

	return router
}

// New will initialize a server struct and populate fields with their initial state
func New(influxdbClient *influxdb.Client, mavlinkClient *mav.Client) Server {
	server := Server{}

	server.influxDBClient = influxdbClient
	server.mavlinkClient = mavlinkClient

	return server
}

/*
Starts the server on localhost:5000. Make sure nothing else runs on port 5000 if you want the plane to fly.
*/
func (server *Server) Start() {
	router := server.SetupRouter()
	server.Manager = manager.NewManager()

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

/*
User (plane/jetson) sends cropped image, bounding box, and other plane telemetry, and it is saved in the server struct.
*/
func (server *Server) postOBCTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		unclassifiedODLCData := []cvs.UnclassifiedODLC{}
		err := c.BindJSON(&unclassifiedODLCData)

		if err == nil {
			server.UnclassifiedTargets = append(server.UnclassifiedTargets, unclassifiedODLCData...)
			c.String(http.StatusOK, "Accepted ODLC data")
			return
		}
		c.String(http.StatusBadRequest, err.Error())
	}
}

/*
Returns an integer representing the Unix time of when startMissionTimer() was called.
This is intended to be passed to Houston, which will then convert it to the time since the mission started.
*/
func (server *Server) getTimeElapsed() gin.HandlerFunc {
	return func(c *gin.Context) {
		// if time hasn't been initialized yet, throw error
		if server.MissionTime == 0 {
			c.String(http.StatusBadRequest, "ERROR: time hasn't been initalized yet") // not sure if there's a built-in error message to use here
		} else {
			c.String(http.StatusOK, fmt.Sprint(server.MissionTime))
		}
	}
}

/*
Starts a timer when the mission begins, in order to keep track of how long the mission has gone on.
*/
func (server *Server) startMissionTimer() gin.HandlerFunc {
	return func(c *gin.Context) {
		server.MissionTime = time.Now().Unix()
		c.String(http.StatusOK, "Mission timer successfully started!")
	}
}

/*
Query Hub for the mission's current state
*/
func (server *Server) getState() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.String(http.StatusOK, server.Manager.State.String())
	}
}

/*
Request a change to the mission's state
The request will error with code 409 CONFLICT if it is an invalid state change
*/
func (server *Server) changeState() gin.HandlerFunc {
	return func(c *gin.Context) {
		stateJSON := manager.StateJSON{}
		err := c.BindJSON(&stateJSON)

		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
		}

		prevState := server.Manager.State
		state := stateJSON.ToEnum()

		if server.Manager.ChangeState(state) {
			c.String(http.StatusOK, fmt.Sprintf("Successful state change: %s to %s.", prevState, state))
		} else {
			c.String(http.StatusConflict, fmt.Sprintf("Invalid state change: %s to %s.", prevState, state))
		}
	}
}

/*
Returns the starting time of the current state in seconds since epoch
*/
func (server *Server) getStateStartTime() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.String(http.StatusOK, fmt.Sprintf("%d", server.Manager.GetCurrentStateStartTime()))
	}
}

/*
Returns the list of state changes that have occurred, with timestamps
*/
func (server *Server) getStateHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, server.Manager.HistoryJSON())
	}
}

/*
User (person manning ground control station) will type in the ODLC info on each water bottle as well as the ordering of each bottle in the plane, and then click a button on Houston to upload it.

Also note that one of the bottles should dropped on a manikin (won't have alphanumeric/color?)

IDEA (to implement in the future): check to make sure the length of the bottle slice is no more than 5 (there should only be 5 bottles uploaded, but if there's some error we might want to be able to upload less).
*/
func (server *Server) uploadDropOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		bottleOrdering := airdrop.Bottles{}

		err := c.BindJSON(&bottleOrdering.Bottles)

		if err == nil {
			server.Bottles = &bottleOrdering
			c.String(http.StatusOK, "Bottles successfully uploaded!")
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

/*
Returns the information (drop index, which target to drop on, etc.) about each water bottle as it has been entered by the person manning the ground control station.
*/
func (server *Server) getDropOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.Bottles == nil {
			c.String(http.StatusBadRequest, "ERROR: drop order not yet initialized")
		} else {
			c.JSON(http.StatusOK, server.Bottles.Bottles)
		}
	}
}

/*
Updates the information about a single water bottle as it was entered by the person manning the ground control station.

This would be useful if there was a mistake when uploading the original drop ordering, so the information for a single bottle can be updated given an id.

NOTE: this is currently not capable of updating a bottle's dropIndex in case it was entered incorrectly (because identifying the bottle to update is dependent on the dropIndex in the patch request body).
If we want to change this, one solution would be to have an extra field in the json body for the dropIndex to update, and then in the proceeding struct the user would be able to enter a replacement dropIndex.

If all bottles need to be updated at once, the user should just use the POST request (uploadDropOrder(); will clear everything and overwrite with the post body).
*/
func (server *Server) updateDropOrder() gin.HandlerFunc {
	return func(c *gin.Context) {
		bottleToUpdate := airdrop.Bottle{}
		err := c.BindJSON(&bottleToUpdate)

		bottleUpdated := false

		// loop through each of the bottles that are currently uploaded and find the one with the right id, and then overwrite its values
		for i, bottle := range server.Bottles.Bottles {
			if bottle.DropIndex == bottleToUpdate.DropIndex {
				server.Bottles.Bottles[i] = bottleToUpdate
				bottleUpdated = true
			}
		}

		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
			return
		}

		if bottleUpdated {
			c.String(http.StatusOK, "Bottle %d has been updated!", bottleToUpdate.DropIndex)
		} else {
			c.String(http.StatusBadRequest, "ERROR: Bottle %d not found. Make sure the entire drop order has been initialized before updating individual bottles!", bottleToUpdate.DropIndex)
		}
	}
}

func (server *Server) getFlightBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.Mission.FlightBoundaries == nil {
			c.String(http.StatusBadRequest, "ERROR: Flight bounds not yet initialized")
		} else {
			c.JSON(http.StatusOK, server.Mission.FlightBoundaries)
		}
	}
}

/*
Reads in longitude and latitude coordinates for flight bounds and uploads to the server
*/
func (server *Server) uploadFlightBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		flightBounds := []pp.Coordinate{}
		err := c.BindJSON(&flightBounds)

		if err == nil {
			server.Mission.FlightBoundaries = flightBounds
			c.String(http.StatusOK, "Flight Bounds has been uploaded", flightBounds)
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

func (server *Server) getSearchBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.Mission.SearchBoundaries == nil {
			c.String(http.StatusBadRequest, "ERROR: Search bounds not yet initialized")
		} else {
			c.JSON(http.StatusOK, server.Mission.SearchBoundaries)
		}
	}
}

/*
Reads in longitude and latitude coordinates for airdrop bounds and uploads to the server
*/
func (server *Server) uploadSearchBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		searchBounds := []pp.Coordinate{}
		err := c.BindJSON(&searchBounds)

		if err == nil {
			server.Mission.SearchBoundaries = searchBounds
			c.String(http.StatusOK, "Search Bounds have been uploaded", searchBounds)
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

/*
CVS sends results (target coordinates, alphanumeric, shape, color) to Hub and forward target coordinates to RTPP
*/
func (server *Server) postCVSResults() gin.HandlerFunc {
	return func(c *gin.Context) {
		cvsResults := cvs.ClassifiedODLC{}
		err := c.BindJSON(&cvsResults)

		if err == nil {
			c.String(http.StatusOK, "Successfully received CVS results")
			server.ClassifiedTargets = append(server.ClassifiedTargets, cvsResults)
			//TODO: forward target coordinates to path planning when OBC2 client is finished
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

/*
Request target data that was posted earlier via postCVSResults
*/
func (server *Server) getStoredCVSResults() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.ClassifiedTargets == nil {
			c.String(http.StatusBadRequest, "ERROR: CVS results have not been posted yet")
		} else {
			c.JSON(http.StatusOK, server.ClassifiedTargets)
		}
	}
}

/*
Retrieve the Initial path struct stored on the server
Sent from Houston to Hub for displaying
*/
func (server *Server) getInitialPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.InitialPath == nil {
			c.String(http.StatusBadRequest, "ERROR: Initial path has not been posted yet.")
		} else {
			c.JSON(http.StatusOK, server.InitialPath)
		}
	}
}

/*
Upload the initial path the plane will fly.
Sent from OBC to Hub for storing.
*/
func (server *Server) uploadInitialPath() gin.HandlerFunc {
	return func(c *gin.Context) {
		var initialPath []pp.Waypoint

		err := c.BindJSON(&initialPath)

		if err != nil {
			c.String(http.StatusBadRequest, err.Error())
		} else {
			server.InitialPath = initialPath
			c.String(http.StatusOK, "Initial path successfully uploaded")
		}
	}
}

/*
Tell OBC to start generating initial path.
Sent from Houston to Hub, Hub then goes to OBC
*/
func (server *Server) generateInitialPath() gin.HandlerFunc {
	// TODO: make request to path planning to start generating the initial path
	return func(c *gin.Context) {
		c.String(http.StatusInternalServerError, "ERROR: route not implemented yet")
	}
}
