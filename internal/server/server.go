package server

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"github.com/rs/cors"
	"github.com/sirupsen/logrus"

	ic "github.com/tritonuas/hub/internal/interop"
)

var Log = logrus.New()

// Server provides the implementation for the hub server that communicates
// with other parts of the plane's system and houston
type Server struct {
	port   string
	client *ic.Client

	telemetry []byte // Holds the most recent telemetry data sent to the interop server

	path *Path // Holds the path of the plane, see the definition of the struct for more details

	homePosition *ic.Position // Home position of the plane, which must be set by us

	missionID MissionID // ID of the mission that we are assigned

	//mission TODO Actually hold the mission object for pyplanner to request
}

// Run starts the hub http server and establishes all of the uri's that it
// will receive
func (s *Server) Run(
	port string,
	interopChannel chan *ic.Client,
	interopMissionID int,
	telemetryChannel chan *ic.Telemetry) {

	s.missionID = MissionID{ID: interopMissionID}

	s.port = fmt.Sprintf(":%s", port)
	s.client = nil
	go s.ConnectToInterop(interopChannel)
	mux := http.NewServeMux()
	mux.Handle("/hub/interop/teams", &interopTeamHandler{server: s})
	mux.Handle("/hub/interop/missions", &interopMissionHandler{server: s})
	mux.Handle("/hub/interop/telemetry", &interopTelemHandler{server: s})
	mux.Handle("/hub/mission", &missionHandler{server: s})
	mux.Handle("/hub/plane/telemetry", &planeTelemHandler{server: s})
	mux.Handle("/hub/plane/path", &planePathHandler{server: s})
	mux.Handle("/hub/plane/home", &planeHomeHandler{server: s})

	mux.Handle("/hub/interop/odlc/", &interopOdlcHandler{server: s})
	
	/*
	mux.Handle("/hub/interop/odlcs", )
	mux.Handle("/hub/interop/odlc/image/", )
	*/

	c := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
	})

	go s.CacheAndUploadTelem(telemetryChannel)
	handler := c.Handler(mux)
	http.ListenAndServe(s.port, handler)
}

func (s *Server) ConnectToInterop(channel chan *ic.Client) {
	s.client = <-channel
	Log.Info("Server client object initialized: Interop fully connected.")
}

// CacheAndUploadTelem sends the telemetry to the server and caches it and uploads it to interop
// continually as telemetry data is received from mavlink
func (s *Server) CacheAndUploadTelem(channel chan *ic.Telemetry) {
	for true {
		telem := <-channel
		telemData, _ := json.Marshal(&telem)
		s.telemetry = telemData

		// TODO: consider putting a rate limit on this so we don't spam the interop server?
		if s.client != nil && s.client.IsConnected() {
			s.client.PostTelemetry(telemData)
		}
	}
}

func logRequestInfo(r *http.Request) {
	Log.Infof("Request to Hub from %s: %s %s", r.RemoteAddr, r.Method, r.URL)
}

type missionHandler struct {
	server *Server
}

// This object captures changes to the mission ID stored in Hub
// To change the mission ID that hub is using:
// POST /interop/missions
// {
//  	"id": [MISSION_ID]
// }

// MissionID is an object used to capture a mission ID parameter
type MissionID struct {
	ID int `json:"id"`
}

func (m *missionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		idData, _ := json.Marshal(m.server.missionID)
		w.Write(idData)
		Log.Infof("Successfully retrieved mission ID information: id = %d", m.server.missionID)

	case "POST":
		// Change the stored mission ID
		idData, _ := ioutil.ReadAll(r.Body)
		var id MissionID
		err := json.Unmarshal(idData, &id)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(fmt.Sprintf("Unable to parse mission id: %s", err.Error())))
			Log.Errorf("Unable to parse mission id: %s", err.Error())
		} else {
			oldID := m.server.missionID
			m.server.missionID = id
			w.Write([]byte(fmt.Sprintf("Successfully updated mission id from %d to %d", oldID, m.server.missionID)))
			Log.Infof("Successfully updated mission id from %d to %d", oldID, m.server.missionID)
		}

	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not implemented"))
	}
}

// Handles uploading and retreiving the home position of the plane
type planeHomeHandler struct {
	server *Server
}

func (p *planeHomeHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		if p.server.homePosition == nil {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("No home position has been set."))
			Log.Info("No home position has been set.")
		} else {
			jsonData, _ := json.Marshal(&p.server.homePosition)
			w.Write(jsonData)
			Log.Info("Successfully returned set home position.")
		}
		break
	case "POST":
		msgBody, _ := ioutil.ReadAll(r.Body)
		var homePos ic.Position
		err := json.Unmarshal(msgBody, &homePos)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(fmt.Sprintf("Error parsing home position: %s", err.Error())))
			Log.Errorf("Unable to parse home position: %s", err.Error())
			break
		}

		if homePos.Latitude == nil || homePos.Longitude == nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Error: Latitude and/or longitude not properly set."))
			Log.Errorf("Latitude and/or longitude not properly set.")
			break
		}

		p.server.homePosition = &homePos
		w.Write([]byte("Successfully updated home position."))
		Log.Info("Successfully updated home position.")
		break
	}
}

// Handles POST requests
type planePathHandler struct {
	server *Server
}

func (p *planePathHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		if p.server.path != nil && p.server.path.GetOriginalJSON() != nil {
			pathData := p.server.path.GetOriginalJSON()
			w.Write([]byte(pathData))
			Log.Info("Successfully retrieved path data.")
		} else {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("No path found."))
			Log.Error("No path found.")
		}
		break

	case "POST":
		pathData, _ := ioutil.ReadAll(r.Body)

		var err error
		p.server.path, err = CreatePath(pathData)

		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(fmt.Sprintf("Error processing path data: %s", err.Error())))
			Log.Errorf("Error processing path data: %s", err.Error())
			break
		}

		p.server.path.Display()

		w.Write([]byte("Successfully uploaded path to hub"))
		Log.Info("Successfully updated stored path.")

	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

// Handles GET requests that ask for our Plane's telemetry data
type planeTelemHandler struct {
	server *Server
}

func (t *planeTelemHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	switch r.Method {
	case "GET":
		if t.server.telemetry == nil {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte("No telemetry found. Is the plane flying?"))
			Log.Error("No telemetry found. Is the plane flying?")
			break
		}

		w.Write(t.server.telemetry)
		Log.Info("Successfully retrieved our plane's telemetry.")
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

// Handles GET requests that ask for Team Status information
type interopTeamHandler struct {
	server *Server
}

func (t *interopTeamHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		if t.server.client == nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Interop connection not established"))
			Log.Errorf("Unable to retrieve team data from Interop because connection to Interop not established")
			return
		}

		// Make the GET request to the Interop Server
		teams, err := t.server.client.GetTeams()
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
type interopMissionHandler struct {
	server *Server
}

func (m *interopMissionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		// Make the GET request to the interop server
		if m.server.client == nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Interop connection not established"))
			Log.Errorf("Unable to retrieve mission data from Interop because connection to Interop not established")
			return
		}

		mission, err := m.server.client.GetMission(m.server.missionID.ID)
		if err.Get {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to retrieve mission data from Interop: %s", err.Message)
		} else {
			w.Write(mission)
			Log.Info("Successfully retrieved mission from Interop.")
		}

	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

// Handles POST requests to the server that upload telemetry data
type interopTelemHandler struct {
	server *Server
}

func (t *interopTelemHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		if t.server.client == nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Interop connection not established"))
			Log.Errorf("Unable to retrieve telemetry data from Interop because connection to Interop not established")
			return
		}

		// We want to parse the teams data to find all of the telemetry of the other planes
		teamsData, _ := t.server.client.GetTeams()
		var teamsList []ic.TeamStatus
		json.Unmarshal(teamsData, &teamsList)

		// We have a list of TeamStatuses in teamsList, now convert to a list of
		// Telemetry, and return that back into json
		var telemList []ic.Telemetry
		for i := 0; i < len(teamsList); i++ {
			team := &teamsList[i]

			// We don't want to get our own telemety or telemetry from planes
			// not in the air, so filter out those
			if team.GetTeam().GetUsername() != t.server.client.GetUsername() && team.GetInAir() {
				// To prevent a crash if a team has taken off but not uploaded any telemetry
				if team.GetTelemetry() != nil {
					telemList = append(telemList, *team.GetTelemetry())
				}
			}
		}

		// Now telemlist should have all the other teams telemetry, so lets turn it back into
		// a []byte
		telemData, _ := json.Marshal(telemList)
		if len(telemList) > 0 {
			w.Write(telemData)
			Log.Infof("Successfully retrieved telemetry data from %d other team(s) flying right now", len(telemList))
		} else {
			w.Write([]byte("There are no other teams in the air transmitting telemetry."))
			Log.Infof("There are no other teams in the air transmitting telemtry.")
		}

	case "POST":
		if t.server.client == nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Interop connection not established"))
			Log.Errorf("Unable to post telemetry data to Interop because connection to Interop not established")
			return
		}

		telemData, _ := ioutil.ReadAll(r.Body)
		// Make the POST request to the interop server
		err := t.server.client.PostTelemetry(telemData)
		if err.Post {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to post telemetry data to Interop: %s", err.Message)
		} else {
			w.Write([]byte("Telemetry successfully uploaded"))
			Log.Info("Successfully uploaded telemetry data to Interop.")
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

// Handles all requests related to singular odlc
// e.g. /hub/interop/odlc/
type interopOdlcHandler struct {
	server *Server
}

//it will be a miracle if this works
func (o *interopOdlcHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	if o.server.client == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Interop connection not established"))
		Log.Errorf("Unable to get odlc data from Interop because connection to Interop not established")
		return
	}

	splitURI := strings.Split(r.URL.Path, "/")
	missionID, _ := strconv.Atoi(splitURI[4])

	switch r.Method {
	case "GET":
		odlcData, intErr := o.server.client.GetODLC(missionID)
		if intErr.Get {
			w.WriteHeader(intErr.Status)
			w.Write(intErr.Message)
			Log.Errorf("Unable to retrieve ODLC %d from Interop: %s", missionID, intErr.Message)
		} else {
			// Everything is OK!
			// This Write statment corresponds to a successful GET request in the format:
			// GET /interop/odlcs/X where X is a valid integer
			w.Write(odlcData)
			Log.Infof("Successfully retrieved ODLC %d from Interop", missionID)
		}
	case "PUT":
		odlcData, _ := ioutil.ReadAll(r.Body)
		updatedOdlc, err := o.server.client.PutODLC(missionID, odlcData)
		if err.Put {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to update ODLC %d on Interop: %s", missionID, err.Message)
		} else {
			// This Write statement corresponds to a successful PUT request in the format:
			// PUT /interop/odlcs/X where X is a valid integer
			w.Write(updatedOdlc)
			Log.Infof("Successfully updated ODLC %d on Interop", missionID)
		}
	case "DELETE":
		err := o.server.client.DeleteODLC(missionID)
		if err.Delete {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to delete ODLC %d on Interop: %s", missionID, err.Message)
		} else {
			// This Write statement corresponds to a successful DELETE request in the format:
			// DELETE /interop/odlcs/X where X is a valid integer
			w.Write([]byte(fmt.Sprintf("Successfully deleted odlc %d", missionID)))
			Log.Infof("Successfuly deleted ODLC %d on Interop", missionID)
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

/*
type interopOdlcsHandler struct {
	server *Server
}

func (o *interopOdlcHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
						Log.Errorf("Bad Request Format - Exptected valid integer X in query parameter ?mission=X")
						return
					}
					odlcsData, intErr := o.server.client.GetODLCs(missionID)
					if intErr.Get {
						w.WriteHeader(intErr.Status)
						w.Write(intErr.Message)
						Log.Errorf("Unable to retrieve ODLCS via mission ID %d from Interop: %s", missionID, intErr.Message)
					} else {
						// Everything is OK!
						// This Write statement corresponds to a successful GET request in the format:
						// GET /interop/odlcs?mission=X where X is a valid integer
						w.Write(odlcsData)
						Log.Infof("Successfully retrieved ODLCS via mission ID %d from Interop", missionID)
					}
				} else {
					w.WriteHeader(http.StatusBadRequest)
					w.Write([]byte("Bad Request Format - Cannot provide both query parameter ?mission and mission param like /api/odlcs/{id}"))
					Log.Errorf("Bad Request Format - Cannot provide both query parameter ?mission and mission param like /api/odlcs/{id}")
				}
			} else {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Cannot provide query parameters other than ?mission"))
				Log.Errorf("Bad Request Format - Cannot provide query parameters other than ?mission")
			}
		} else {
			// The user wants the odlc data from a specific ODLC, and the id of that odlc
			// is stored in missionID
			odlcData, intErr := o.server.client.GetODLC(missionID)
			if intErr.Get {
				w.WriteHeader(intErr.Status)
				w.Write(intErr.Message)
				Log.Errorf("Unable to retrieve ODLC %d from Interop: %s", missionID, intErr.Message)
			} else {
				// Everything is OK!
				// This Write statment corresponds to a successful GET request in the format:
				// GET /interop/odlcs/X where X is a valid integer
				w.Write(odlcData)
				Log.Infof("Successfully retrieved ODLC %d from Interop", missionID)
			}
		}
	case "PUT":
		if missionID == noMission {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Bad Request Format - Must provide a mission ID for a PUT request"))
			Log.Error("Bad Request Format - Must provide a mission ID for a PUT request")
		} else {
			odlcData, _ := ioutil.ReadAll(r.Body)
			updatedOdlc, err := o.server.client.PutODLC(missionID, odlcData)
			if err.Put {
				w.WriteHeader(err.Status)
				w.Write(err.Message)
				Log.Errorf("Unable to update ODLC %d on Interop: %s", missionID, err.Message)
			} else {
				// This Write statement corresponds to a successful PUT request in the format:
				// PUT /interop/odlcs/X where X is a valid integer
				w.Write(updatedOdlc)
				Log.Infof("Successfully updated ODLC %d on Interop", missionID)
			}
		}
	case "DELETE":
		if missionID == noMission {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Bad Request Format - Must provide a mission ID for a DELETE request."))
			Log.Errorf("Bad Request Format - Must provide a mission ID for a DELETE request.")
		} else {
			err := o.server.client.DeleteODLC(missionID)
			if err.Delete {
				w.WriteHeader(err.Status)
				w.Write(err.Message)
				Log.Errorf("Unable to delete ODLC %d on Interop: %s", missionID, err.Message)
			} else {
				// This Write statement corresponds to a successful DELETE request in the format:
				// DELETE /interop/odlcs/X where X is a valid integer
				w.Write([]byte(fmt.Sprintf("Successfully deleted odlc %d", missionID)))
				Log.Infof("Successfuly deleted ODLC %d on Interop", missionID)
			}
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

func (o *interopOdlcHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		image, err := o.server.client.GetODLCImage(missionID)
		if err.Get {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to get ODLC image from Interop: %s", err.Message)
		} else {
			// This Write statement corresponds to a successful request in the format
			// GET /interop/odlcs/X/image
			w.Write(image)
			Log.Info("Successfully retrieved ODLC image from Interop.")
		}
	case "PUT":
		image, _ := ioutil.ReadAll(r.Body)
		err := o.server.client.PutODLCImage(missionID, image)
		if err.Put {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to update ODLC image on Interop: %s", err.Message)
		} else {
			// This Write statement corresponds to a successful request in the format
			// PUT /interop/odlcs/X/image
			w.Write([]byte(fmt.Sprintf("Successfully uploaded odlc image for odlc %d", missionID)))
			Log.Infof("Successfully uploaded ODLC image for ODLC %d", missionID)
		}
	case "DELETE":
		err := o.server.client.DeleteODLCImage(missionID)
		if err.Delete {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to update ODLC image on Interop: %s", err.Message)
		} else {
			// This Write statement corresponds to a successful request in the format
			// DELETE /interop/odlcs/X/image
			w.Write([]byte(fmt.Sprintf("Successfully deleted ODLC image for ODLC %d", missionID)))
			Log.Infof("Successfully deleted ODLC image for ODLC %d", missionID)
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not implemented"))
	}
}
*/

/* old code:
func (o *interopOdlcHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	if o.server.client == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Interop connection not established"))
		Log.Errorf("Unable to get odlc data from Interop because connection to Interop not established")
		return
	}
	// I hate this function and we should seriously considering either fixing it or making
	// it way simpler by not attempting to match exactly the API interop uses, and instead
	// only implementing the ones that we want to use

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

	// THIS CODE SUCKS AND IF THE NUMBER OF WORDS IN THE URL CHANGES THESE HAVE TO CHANGE AS WELL
	// I WANT TO NUKE THIS FUNCTION AND FIX THIS SOME DAY
	// UNTIL THEN, SORRY

	if len(splitURI) == 5 || len(splitURI) == 6 {
		// update mission to the value they want it to be
		var err error
		missionID, err = strconv.Atoi(splitURI[4])
		if err != nil {
			// Either the user didn't supply a mission, or they provided a non integer
			// value. Either way, we will assume they didn't try to specifiy an ID
			// and override whatever junk value was placed into missionID
			missionID = noMission
		}
		if len(splitURI) == 6 && splitURI[len(splitURI)-1] == "image" { // Check if user trying to do something with images
			imageRequest = true
		}
	}

	if imageRequest {
		if missionID == noMission {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Bad Request Format - Must provide a valid mission ID for odlc image requests"))
			Log.Error("Bad Request Format - Must provide a valid mission ID for odlc image requests")
		} else {
			switch r.Method {
			case "GET":
				image, err := o.server.client.GetODLCImage(missionID)
				if err.Get {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
					Log.Errorf("Unable to get ODLC image from Interop: %s", err.Message)
				} else {
					// This Write statement corresponds to a successful request in the format
					// GET /interop/odlcs/X/image
					w.Write(image)
					Log.Info("Successfully retrieved ODLC image from Interop.")
				}
			case "PUT":
				image, _ := ioutil.ReadAll(r.Body)
				err := o.server.client.PutODLCImage(missionID, image)
				if err.Put {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
					Log.Errorf("Unable to update ODLC image on Interop: %s", err.Message)
				} else {
					// This Write statement corresponds to a successful request in the format
					// PUT /interop/odlcs/X/image
					w.Write([]byte(fmt.Sprintf("Successfully uploaded odlc image for odlc %d", missionID)))
					Log.Infof("Successfully uploaded ODLC image for ODLC %d", missionID)
				}
			case "DELETE":
				err := o.server.client.DeleteODLCImage(missionID)
				if err.Delete {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
					Log.Errorf("Unable to update ODLC image on Interop: %s", err.Message)
				} else {
					// This Write statement corresponds to a successful request in the format
					// DELETE /interop/odlcs/X/image
					w.Write([]byte(fmt.Sprintf("Successfully deleted ODLC image for ODLC %d", missionID)))
					Log.Infof("Successfully deleted ODLC image for ODLC %d", missionID)
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
							Log.Errorf("Bad Request Format - Exptected valid integer X in query parameter ?mission=X")
							return
						}
						odlcsData, intErr := o.server.client.GetODLCs(missionID)
						if intErr.Get {
							w.WriteHeader(intErr.Status)
							w.Write(intErr.Message)
							Log.Errorf("Unable to retrieve ODLCS via mission ID %d from Interop: %s", missionID, intErr.Message)
						} else {
							// Everything is OK!
							// This Write statement corresponds to a successful GET request in the format:
							// GET /interop/odlcs?mission=X where X is a valid integer
							w.Write(odlcsData)
							Log.Infof("Successfully retrieved ODLCS via mission ID %d from Interop", missionID)
						}
					} else {
						w.WriteHeader(http.StatusBadRequest)
						w.Write([]byte("Bad Request Format - Cannot provide both query parameter ?mission and mission param like /api/odlcs/{id}"))
						Log.Errorf("Bad Request Format - Cannot provide both query parameter ?mission and mission param like /api/odlcs/{id}")
					}
				} else {
					w.WriteHeader(http.StatusBadRequest)
					w.Write([]byte("Bad Request Format - Cannot provide query parameters other than ?mission"))
					Log.Errorf("Bad Request Format - Cannot provide query parameters other than ?mission")
				}
			} else {
				// There was no query param
				if missionID == noMission {
					// The user didn't provide a specific mission, so they want a list of all the odlcs
					// (We still pass through missionID since a negative number parameter to this function
					// signifies that we don't want to restrict it to a specific mission)
					odlcsData, intErr := o.server.client.GetODLCs(missionID)
					if intErr.Get {
						w.WriteHeader(intErr.Status)
						w.Write(intErr.Message)
						Log.Errorf("Unable to retrieve ODLCs from Interop: %s", intErr.Message)
					} else {
						// Everything is OK!
						// This Write statement corresponds to a successful GET request in the format:
						// GET /interop/odlcs/
						w.Write(odlcsData)
						Log.Infof("Successfully retrieved ODLCs from Interop")
					}
				} else {
					// The user wants the odlc data from a specific ODLC, and the id of that odlc
					// is stored in missionID
					odlcData, intErr := o.server.client.GetODLC(missionID)
					if intErr.Get {
						w.WriteHeader(intErr.Status)
						w.Write(intErr.Message)
						Log.Errorf("Unable to retrieve ODLC %d from Interop: %s", missionID, intErr.Message)
					} else {
						// Everything is OK!
						// This Write statment corresponds to a successful GET request in the format:
						// GET /interop/odlcs/X where X is a valid integer
						w.Write(odlcData)
						Log.Infof("Successfully retrieved ODLC %d from Interop", missionID)
					}
				}
			}
		case "POST":
			if missionID == noMission {
				odlcData, _ := ioutil.ReadAll(r.Body)
				// Make the POST request to the interop server
				updatedODLC, err := o.server.client.PostODLC(odlcData)
				if err.Post {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
					Log.Errorf("Unable to upload ODLC to Interop: %s", err.Message)
				} else {
					// This Write statement corresponds to a successful POST request in the format:
					// POST /interop/odlcs
					w.Write(updatedODLC)
					Log.Infof("Successfully uploaded ODLC to Interop")
				}
			} else {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Cannot provide a mission ID for a POST request."))
				Log.Errorf("Bad Request Format - Cannot provide a mission ID for a POST request.")
			}
		case "PUT":
			if missionID == noMission {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Must provide a mission ID for a PUT request"))
				Log.Error("Bad Request Format - Must provide a mission ID for a PUT request")
			} else {
				odlcData, _ := ioutil.ReadAll(r.Body)
				updatedOdlc, err := o.server.client.PutODLC(missionID, odlcData)
				if err.Put {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
					Log.Errorf("Unable to update ODLC %d on Interop: %s", missionID, err.Message)
				} else {
					// This Write statement corresponds to a successful PUT request in the format:
					// PUT /interop/odlcs/X where X is a valid integer
					w.Write(updatedOdlc)
					Log.Infof("Successfully updated ODLC %d on Interop", missionID)
				}
			}
		case "DELETE":
			if missionID == noMission {
				w.WriteHeader(http.StatusBadRequest)
				w.Write([]byte("Bad Request Format - Must provide a mission ID for a DELETE request."))
				Log.Errorf("Bad Request Format - Must provide a mission ID for a DELETE request.")
			} else {
				err := o.server.client.DeleteODLC(missionID)
				if err.Delete {
					w.WriteHeader(err.Status)
					w.Write(err.Message)
					Log.Errorf("Unable to delete ODLC %d on Interop: %s", missionID, err.Message)
				} else {
					// This Write statement corresponds to a successful DELETE request in the format:
					// DELETE /interop/odlcs/X where X is a valid integer
					w.Write([]byte(fmt.Sprintf("Successfully deleted odlc %d", missionID)))
					Log.Infof("Successfuly deleted ODLC %d on Interop", missionID)
				}
			}
		default:
			w.WriteHeader(http.StatusNotImplemented)
			w.Write([]byte("Not Implemented"))
		}
	}
}
*/
