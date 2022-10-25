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

func (s *Server) SetupRouter() *gin.Engine {
	router := gin.Default()

	router.POST("/obc/targets", s.postOBCTargets())

	return router
}

func (s *Server) Start() {
	router := s.SetupRouter()

	router.Run(":5000")
}

func (s *Server) postOBCTargets() gin.HandlerFunc { 
	return func(c *gin.Context) {
		unclassifiedODLCData := cv.UnclassifiedODLC{}
		if (c.BindJSON(&unclassifiedODLCData) == nil) {
			s.unclassifiedTargets = append(s.unclassifiedTargets, unclassifiedODLCData)
			c.Status(http.StatusOK)
		}
	}
}

