package server

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/sirupsen/logrus"
	cv "github.com/tritonuas/hub/internal/computer_vision"
	mav "github.com/tritonuas/hub/internal/mavlink"
)

var Log = logrus.New()

/*
Stores the server state and data that the server deals with.
*/
type Server struct {
	UnclassifiedTargets []cv.UnclassifiedODLC
	TelemetryLatest     *mav.Telemetry
	TelemetryHistory    []mav.Telemetry
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

	router.Run(":5000")
}

func (server *Server) postOBCTargets() gin.HandlerFunc {
	return func(c *gin.Context) {
		unclassifiedODLCData := cv.UnclassifiedODLC{}
		err := c.BindJSON(&unclassifiedODLCData)

		if err == nil {
			server.UnclassifiedTargets = append(server.UnclassifiedTargets, unclassifiedODLCData)
			c.String(http.StatusOK, "Accepted ODLC data")
		} else {
			c.String(http.StatusBadRequest, err.Error())
		}
	}
}

// Todo: Get from InfluxDB if none cached.
func (server *Server) getTelemetry() gin.HandlerFunc {
	return func(c *gin.Context) {
		telem := server.TelemetryLatest

		if telem == nil {
			// First telemetry hasn't been entered yet.
			c.Status(http.StatusNoContent)
		} else {
			c.JSON(http.StatusOK, *server.TelemetryLatest)
		}
	}
}

// Todo: Post to InfluxDB.
func (server *Server) postTelemetry() gin.HandlerFunc {
	return func(c *gin.Context) {

		jsonData, err := ioutil.ReadAll(c.Request.Body)
		if err != nil {
			c.Status(400)
		}

		if jsonData == nil {
			// First telemetry hasn't been entered yet.
			c.Status(http.StatusNoContent)
		} else {
			newTelem := mav.Telemetry{}
			json.Unmarshal(jsonData, newTelem)
			if !mav.ValidateTelemetry(newTelem) {
				c.Status(400)
			}
			server.TelemetryHistory = append(server.TelemetryHistory, newTelem)
			*server.TelemetryLatest = newTelem
			c.Status(http.StatusNoContent)
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
		}

		index, err := strconv.Atoi(string(strData))
		// Invalid request data
		if err != nil {
			c.Status(400)
		}
		// Valid, but no Telemetry to return
		if index == 0 && server.TelemetryLatest == nil {
			c.Status(http.StatusNoContent)
		}
		// Invalid index to get
		if index < 0 || index >= len(server.TelemetryHistory) {
			c.Status(400)
		}
		// Return the index'th telemetry back.
		c.JSON(http.StatusOK, server.TelemetryHistory[len(server.TelemetryHistory)-index-1])
	}
}
