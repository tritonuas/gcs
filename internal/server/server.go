package server

import (
	"net/http"
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
}

func (server *Server) SetupRouter() *gin.Engine {
	router := gin.Default()

	router.POST("/obc/targets", server.postOBCTargets())

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

