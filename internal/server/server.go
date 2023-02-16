package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sirupsen/logrus"
	"github.com/tritonuas/hub/internal/cvs"
	"github.com/tritonuas/hub/internal/manager"
	"github.com/tritonuas/hub/internal/obc/airdrop"
)

// Log is the logger for the server
var Log = logrus.New()

/*
Stores the server state and data that the server deals with.
*/
type Server struct {
	UnclassifiedTargets []cvs.UnclassifiedODLC `json:"unclassified_targets"`
	Bottles             *airdrop.Bottles
	MissionTime         time.Time
	FlightBounds        []Coordinate
	AirDropBounds       []Coordinate
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

/*
Initializes all http request routes (tells the server which handler functions to call when a certain route is requested).

General route format is "/place/thing".
*/
func (server *Server) SetupRouter() *gin.Engine {
	router := gin.Default()
	router.Use(CORSMiddleware())

	router.GET("/connections", server.testConnections())

	router.POST("/obc/targets", server.postOBCTargets())

	router.GET("/hub/time", server.getTimeElapsed())
	router.POST("/hub/time", server.startMissionTimer())

	router.GET("/hub/state", server.getState())
	router.POST("/hub/state", server.changeState())
	router.GET("/hub/state/time", server.getStateStartTime())
	router.GET("/hub/state/history", server.getStateHistory())

	router.POST("/plane/airdrop", server.uploadDropOrder())
	router.GET("/plane/airdrop", server.getDropOrder())
	router.PATCH("/plane/airdrop", server.updateDropOrder())

	/* Change field to flight */
	router.GET("/mission/bounds/field", server.getFieldBounds())
	router.POST("/mission/bounds/field", server.uploadFieldBounds())

	router.GET("/mission/bounds/airdrop", server.getAirdropBounds())
	router.POST("/mission/bounds/airdrop", server.uploadAirDropBounds())

	router.POST("/cvs/targets", server.postCVSResults())
	router.GET("/cvs/targets", server.getStoredCVSResults())

	return router
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
		c.JSON(http.StatusOK, gin.H{"path_planning": true, "cvs": true, "jetson": true})
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
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

/*
Returns the current time that has passed since the mission started.
*/
func (server *Server) getTimeElapsed() gin.HandlerFunc {
	return func(c *gin.Context) {
		// if time hasn't been initialized yet, throw error
		if (server.MissionTime == time.Time{}) {
			c.String(http.StatusBadRequest, "ERROR: time hasn't been initalized yet") // not sure if there's a built-in error message to use here
		} else {
			c.String(http.StatusOK, fmt.Sprintf("%f", time.Since(server.MissionTime).Seconds()))
		}
	}
}

/*
Starts a timer when the mission begins, in order to keep track of how long the mission has gone on.
*/
func (server *Server) startMissionTimer() gin.HandlerFunc {
	return func(c *gin.Context) {
		server.MissionTime = time.Now()
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

func (server *Server) getFieldBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.FlightBounds == nil {
			c.String(http.StatusBadRequest, "ERROR: Flight bounds not yet initialized")
		} else {
			c.JSON(http.StatusOK, server.FlightBounds)
		}
	}
}

/*
Reads in longitude and latitude coordinates for field bounds and uploads to the server
*/
func (server *Server) uploadFieldBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		fieldBounds := []Coordinate{}
		err := c.BindJSON(&fieldBounds)

		if err == nil {
			server.FlightBounds = fieldBounds
			c.String(http.StatusOK, "Field Bounds has been uploaded", fieldBounds)
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

func (server *Server) getAirdropBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		if server.AirDropBounds == nil {
			c.String(http.StatusBadRequest, "ERROR: Airdrop bound not yet initialized")
		} else {
			c.JSON(http.StatusOK, server.AirDropBounds)
		}
	}
}

/*
Reads in longitude and latitude coordinates for airdrop bounds and uploads to the server
*/
func (server *Server) uploadAirDropBounds() gin.HandlerFunc {
	return func(c *gin.Context) {
		airDropBounds := []Coordinate{}
		err := c.BindJSON(&airDropBounds)

		if err == nil {
			server.AirDropBounds = airDropBounds
			c.String(http.StatusOK, "Airdrop Bounds has been uploaded", airDropBounds)
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
