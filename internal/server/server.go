package server

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/sirupsen/logrus"
	cv "github.com/tritonuas/hub/internal/computer_vision"
	mav "github.com/tritonuas/hub/internal/mavlink"
	"github.com/tritonuas/hub/internal/utils"
)

var Log = logrus.New()

/*
Stores the server state and data that the server deals with.
*/
type Server struct {
	UnclassifiedTargets []cv.UnclassifiedODLC
	telemetryLatest     *mav.Telemetry
	telemetryHistory    []mav.Telemetry
	// Convert methods to use influx's data
	influxClient utils.InfluxClient
}

func (server *Server) SetupRouter() *gin.Engine {
	router := gin.Default()

	router.POST("/obc/targets", server.postOBCTargets())
	router.GET("/telemetry/latest", server.getTelemetry())
	router.POST("/telemetry/latest", server.postTelemetry())
	router.GET("/telemetry/history", server.getTelemetryHistory())

	return router
}

func (server *Server) Start() {
	router := server.SetupRouter()

	go server.checkMavlinkMessages(mavUpdates)

	server.generalHistory = make(map[int]MavlinkMessageSeries)

	router.Run(":5000")
}

func (server *Server) postOBCTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		unclassifiedODLCData := cv.UnclassifiedODLC{}
		err := c.BindJSON(&unclassifiedODLCData)

		if err == nil {
			server.UnclassifiedTargets = append(server.UnclassifiedTargets, unclassifiedODLCData)
			c.String(http.StatusOK, "Accepted ODLC data")
			return
		} else {
			c.String(http.StatusBadRequest, err.Error())
			return
		}
	}
}

func (server *Server) getTelemetry() gin.HandlerFunc {
	return func(c *gin.Context) {
		telem := server.telemetryLatest

		if telem == nil {
			// First telemetry hasn't been entered yet.
			c.Status(http.StatusNoContent)
			return
		} else {
			c.JSON(http.StatusOK, *server.telemetryLatest)
			return
		}
	}
}

func (server *Server) postTelemetry() gin.HandlerFunc {
	return func(c *gin.Context) {

		jsonData, err := ioutil.ReadAll(c.Request.Body)
		if err != nil {
			c.Status(http.StatusBadRequest)
			return
		} else if jsonData == nil || len(jsonData) == 0 {
			// Nothing was passed.
			c.Status(http.StatusBadRequest)
			return
		} else {
			newTelem := mav.Telemetry{}
			json.Unmarshal(jsonData, &newTelem)
			// restringifed, _ := json.Marshal(newTelem) NOTE: commenting out this line because restringified was unused -- anthony
			if !mav.ValidateTelemetry(newTelem) {
				c.Status(http.StatusBadRequest)
				return
			}
			server.telemetryHistory = append(server.telemetryHistory, newTelem)
			server.telemetryLatest = &newTelem
			c.Status(http.StatusNoContent)
			return
		}
	}
}

// Currently: Index back from end: 0 -> latest, 1 -> one back, etc.
// Todo: pass timestamp and find telemetry nearest to that timestamp.
// Todo: Use InfluxDB to look-up timestamps.
func (server *Server) getTelemetryHistory() gin.HandlerFunc {
	return func(c *gin.Context) {
		strData, err := ioutil.ReadAll(c.Request.Body)
		if err != nil {
			c.Status(400)
			return
		}

		// Send everything
		restringifed, _ := json.Marshal(server.generalHistory)
		fmt.Printf("postTelemetry json: Unmarshalled: %s\n", restringifed)
		c.String(400, string(restringifed))
		return

		index, err := strconv.Atoi(string(strData))
		// Invalid request data
		if err != nil {
			c.Status(400)
			return
		}
		// Valid, but no Telemetry to return
		if index == 0 && server.telemetryLatest == nil {
			c.Status(http.StatusNoContent)
			return
		}
		// Invalid index to get
		if index < 0 || index >= len(server.telemetryHistory) {
			c.Status(400)
			return
		}
		// Return the index'th telemetry back.
		c.JSON(http.StatusOK, server.telemetryHistory[len(server.telemetryHistory)-index-1])
		return
	}
}
