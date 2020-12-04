package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	ic "github.com/tritonuas/hub/internal/interop"
)

// Server provides the implementation for the hub server that communicates
// with other parts of the plane's system and houston
type Server struct {
	port   string
	client *ic.Client
}

// Run starts the hub http server and establishes all of the uri's that it
// will receive
func (s *Server) Run(port string, c *ic.Client) {
	s.port = fmt.Sprintf(":%s", port)
	http.Handle("/api/teams", &teamHandler{client: c})
	http.Handle("/api/missions/", &missionHandler{client: c})

	http.ListenAndServe(s.port, nil)
}

// Handles GET requests that ask for Team Status information
type teamHandler struct {
	client *ic.Client
}

func (t *teamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		// Make the GET request to the Interop Server
		teams, err := t.client.GetTeams()
		if err.Get {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("500 - Error getting team statuses"))
		} else {
			w.Write(teams)
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("501 - Not Implemented"))
	}
}

// Handles GET requests that ask for the mission parameters
type missionHandler struct {
	client *ic.Client
}

func (m *missionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Get the url path ("/api/missions/{MISSION_ID}")
	path := strings.Split(r.URL.Path, "/")
	// Get the integer value of the mission ID which is the last value in the array
	missionID, err := strconv.Atoi(path[len(path)-1])

	// If there is an error, then the user messed up in creating the request
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("400 - Bad request format"))
	} else { // If no error, check the message method and do appropriate actions
		switch r.Method {
		case "GET":
			// Make the GET request to the interop server
			mission, err := m.client.GetMission(missionID)
			if err.Get {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte("500 - Error getting mission data"))
			} else {
				w.Write(mission)
			}
		default:
			w.WriteHeader(http.StatusNotImplemented)
			w.Write([]byte("501 - Not Implemented"))
		}
	}

}
