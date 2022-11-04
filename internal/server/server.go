package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/sirupsen/logrus"
	cv "github.com/tritonuas/hub/internal/computer_vision"
)

var Log = logrus.New()

/*
 Stores the server state and data that the server deals with.
*/
type Server struct {
	UnclassifiedTargets		[]cv.UnclassifiedODLC
	MissionTime				time.Time
}

func (server *Server) SetupRouter() *gin.Engine {
	router := gin.Default()

	router.POST("/obc/targets", server.postOBCTargets())
	router.GET("/hub/time", server.getTimeElapsed())
	router.POST("/hub/time", server.startMissionTimer())

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

func (server *Server) getTimeElapsed() gin.HandlerFunc {
	return func (c *gin.Context) {
		// if time hasn't been initialized yet, throw error
		if (server.MissionTime == time.Time{}) {
			c.String(http.StatusBadRequest, "ERROR: time hasn't been initalized yet") // not sure if there's a built-in error message to use here
		} else {
			c.String(http.StatusOK, time.Since(server.MissionTime).String())
		}
		
	}
}

func (server *Server) startMissionTimer() gin.HandlerFunc {
	return func (c *gin.Context) {
		server.MissionTime = time.Now()
		c.String(http.StatusOK, "Mission timer successfully started")
	}
}