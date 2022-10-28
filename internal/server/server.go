package server

import (
	"net/http"
	"github.com/gin-gonic/gin"
	cv "github.com/tritonuas/hub/internal/computer_vision"
)

/*
 Stores the server state and data that the server deals with.
*/
type Server struct {
	unclassifiedTargets		[]cv.UnclassifiedODLC
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
		if (c.BindJSON(&unclassifiedODLCData) == nil) {
			server.unclassifiedTargets = append(server.unclassifiedTargets, unclassifiedODLCData)
			c.Status(http.StatusOK)
		}
	}
}

