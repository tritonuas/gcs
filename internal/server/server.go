package server

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"github.com/rs/cors"

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
func (s *Server) Run(port string, cli *ic.Client) {
	s.port = fmt.Sprintf(":%s", port)
	mux := http.NewServeMux()
	mux.Handle("/interop/teams", &teamHandler{client: cli})
	mux.Handle("/interop/missions/", &missionHandler{client: cli})
	mux.Handle("/interop/telemetry", &telemHandler{client: cli})
	mux.Handle("/interop/odlcs/", &odlcHandler{client: cli})

	c := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
	})

	handler := c.Handler(mux)
	http.ListenAndServe(s.port, handler)
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
			w.WriteHeader(err.Status)
			w.Write(err.Message)
		} else {
			w.Write(teams)
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
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
		w.Write([]byte("Bad request format"))
	} else { // If no error, check the message method and do appropriate actions
		switch r.Method {
		case "GET":
			// Make the GET request to the interop server
			mission, err := m.client.GetMission(missionID)
			if err.Get {
				w.WriteHeader(err.Status)
				w.Write(err.Message)
			} else {
				w.Write(mission)
			}
		default:
			w.WriteHeader(http.StatusNotImplemented)
			w.Write([]byte("Not Implemented"))
		}
	}

}

// Handles POST requests to the server that upload telemetry data
type telemHandler struct {
	client *ic.Client
}

func (t *telemHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "POST":
		telemData, _ := ioutil.ReadAll(r.Body)
		// Make the POST request to the interop server
		err := t.client.PostTelemetry(telemData)
		if err.Post {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
		} else {
			w.Write([]byte("Telemetry successfully uploaded"))
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

// Handles all requests related to ODLCs
type odlcHandler struct {
	client *ic.Client
}

func (o *odlcHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Here are all the URI possibilities we expect to see
	// GET /api/odlcs --> get list of all odlcs
	// GET /api/odlcs?mission=X --> get list of all odlcs for mission X
	// GET /api/odlcs/X --> get one specific odlc with id X
	// POST /api/odlcs --> upload the initial copy of an odlc, get back the odlc with id param filled in
	// PUT /api/odlcs/X --> update params of the odlc with id X
	// DELETE /api/odlcs/X --> delete the odlc with id X
	// GET /api/odlcs/X/image --> get the image data for the odlc with id X
	// PUT /api/odlcs/X/image --> upload the image data for the odlc with id X
	// DELETE /api/odlcs/X/image --> delete the image data for the odlc with id X

	// initialize this value to -99, and update if the user specifies a mission
	const noMission int = -99
	missionID := noMission
	// Will be set to true if the user is trying to access/post image data
	imageRequest := false
	// This split string array should be in the format ["", "api", "odlcs" ]
	// OR ["", "api", "odlcs", "X"] where X is the mission value
	// OR if the user is trying to specify an image, then the format will be like this:
	// ["", "api", "odlcs", "X", "image"] (len = 5)
	splitURI := strings.Split(r.URL.Path, "/")
	if len(splitURI) == 4 || len(splitURI) == 5 {
		// update mission to the value they want it to be
		var err error
		missionID, err = strconv.Atoi(splitURI[3])
		if err != nil {
			// Either the user didn't supply a mission, or they provided a non integer
			// value. Either way, we will assume they didn't try to specifiy an ID
			// and override whatever junk value was placed into missionID
			missionID = noMission
		}
		if len(splitURI) == 5 { // Check if it wants to be an image
			imageRequest = true
		}
	} else {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("Bad Request Format"))
		return
	}

	if imageRequest {
		if missionID == noMission {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Bad Request Format - Must provide a valid mission ID for odlc image requests"))
		} else {
			switch r.Method {
			case "GET":
				image, err := o.client.GetODLCImage(missionID)
				if err.Get {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
				} else {
					// This Write statement corresponds to a successful request in the format
					// GET /api/odlcs/X/image
					w.Write(image)
				}
			case "PUT":
				image, _ := ioutil.ReadAll(r.Body)
				err := o.client.PutODLCImage(missionID, image)
				if err.Put {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
				} else {
					// This Write statement corresponds to a successful request in the format
					// PUT /api/odlcs/X/image
					w.Write([]byte(fmt.Sprintf("Successfully uploaded odlc image for odlc %d", missionID)))
				}
			case "DELETE":
				err := o.client.DeleteODLCImage(missionID)
				if err.Delete {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
				} else {
					// This Write statement corresponds to a successful request in the format
					// DELETE /api/odlcs/X/image
					w.Write([]byte(fmt.Sprintf("Successfully deleted odlc image for odlc %d", missionID)))
				}
			default:
				w.WriteHeader(http.StatusNotImplemented)
				w.Write([]byte("Not implemented"))
			}
		}
	} else { // not an image request
		switch r.Method {
		case "GET":
			// Check for ?mission=X query param
			if len(r.URL.Query()) > 0 {
				if val, ok := r.URL.Query()["mission"]; ok {
					// Verify that mission wasn't also set in the URI
					if missionID == noMission {
						var err error
						missionID, err = strconv.Atoi(val[0])
						if err != nil {
							w.WriteHeader(http.StatusBadRequest)
							w.Write([]byte("Bad Request Format - Expected valid integer X in query parameter ?mission=X"))
							return
						}
						odlcsData, intErr := o.client.GetODLCs(missionID)
						if intErr.Get {
							w.WriteHeader(intErr.Status)
							w.Write(intErr.Message)
						} else {
							// Everything is OK!
							// This Write statement corresponds to a successful GET request in the format:
							// GET /api/odlcs?mission=X where X is a valid integer
							w.Write(odlcsData)
						}
					} else {
						w.WriteHeader(http.StatusBadRequest)
						w.Write([]byte("Bad Request Format - Cannot provide both query parameter ?mission and mission param like /api/odlcs/{id}"))
					}
				} else {
					w.WriteHeader(http.StatusBadRequest)
					w.Write([]byte("Bad Request Format - Cannot provide query parameters other than ?mission"))
				}
			} else {
				// There was no query param
				if missionID == noMission {
					// The user didn't provide a specific mission, so they want a list of all the odlcs
					// (We still pass through missionID since a negative number parameter to this function
					// signifies that we don't want to restrict it to a specific mission)
					odlcsData, intErr := o.client.GetODLCs(missionID)
					if intErr.Get {
						w.WriteHeader(intErr.Status)
						w.Write(intErr.Message)
					} else {
						// Everything is OK!
						// This Write statement corresponds to a successful GET request in the format:
						// GET /api/odlcs/
						w.Write(odlcsData)
					}
				} else {
					// The user wants the odlc data from a specific ODLC, and the id of that odlc
					// is stored in missionID
					odlcData, intErr := o.client.GetODLC(missionID)
					if intErr.Get {
						w.WriteHeader(intErr.Status)
						w.Write(intErr.Message)
					} else {
						// Everything is OK!
						// This Write statment corresponds to a successful GET request in the format:
						// GET /api/odlcs/X where X is a valid integer
						w.Write(odlcData)
					}
				}
			}
		case "POST":
			if missionID == noMission {
				odlcData, _ := ioutil.ReadAll(r.Body)
				// Make the POST request to the interop server
				updatedODLC, err := o.client.PostODLC(odlcData)
				if err.Post {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
				} else {
					// This Write statement corresponds to a successful POST request in the format:
					// POST /api/odlcs
					w.Write(updatedODLC)
				}
			} else {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Cannot provide a mission ID for a POST request"))
			}
		case "PUT":
			if missionID == noMission {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Must provide a mission ID for a PUT request"))
			} else {
				odlcData, _ := ioutil.ReadAll(r.Body)
				updatedOdlc, err := o.client.PutODLC(missionID, odlcData)
				if err.Put {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
				} else {
					// This Write statement corresponds to a successful PUT request in the format:
					// PUT /api/odlcs/X where X is a valid integer
					w.Write(updatedOdlc)
				}
			}
		case "DELETE":
			if missionID == noMission {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Must provide a mission ID for a DELETE request"))
			} else {
				err := o.client.DeleteODLC(missionID)
				if err.Delete {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
				} else {
					w.Write([]byte(fmt.Sprintf("Successfully deleted odlc %d", missionID)))
				}
			}
		default:
			w.WriteHeader(http.StatusNotImplemented)
			w.Write([]byte("Not Implemented"))
		}
	}
}
