package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/rs/cors"
	"github.com/sirupsen/logrus"

	ic "github.com/tritonuas/hub/internal/interop"
	// mav "github.com/tritonuas/hub/internal/mavlink"
	pp "github.com/tritonuas/hub/internal/path_plan"
)

var Log = logrus.New()

// https://app.clickup.com/t/28rwhv5

// Server provides the implementation for the hub server that communicates
// with other parts of the plane's system and houston
type Server struct {
	port               string
	client             *ic.Client
	pathPlanningClient *pp.Client

	telemetry []byte // Holds the most recent telemetry data sent to the interop server

	path *pp.Path // Holds the path of the plane, see the definition of the struct for more details

	homePosition *ic.Position // Home position of the plane, which must be set by us

	missionID MissionID

	//mission TODO Actually hold the mission object for pyplanner to request
}

// Run starts the hub http server and establishes all of the uri's that it
// will receive
func (s *Server) Run(
	port string,
	interopChannel chan *ic.Client,
	interopMissionID int,
	rtppChannel chan *pp.Client,
	telemetryChannel chan *ic.Telemetry,
	influxdbURI string,
	influxToken string,
	influxBucket string,
	influxOrg string,
	sendWaypointToPlaneChannel chan *pp.Path) {

	s.missionID = MissionID{ID: interopMissionID}

	s.port = fmt.Sprintf(":%s", port)
	s.client = nil
	go s.ConnectToInterop(interopChannel)
	go s.ConnectToRTPP(rtppChannel)
	mux := http.NewServeMux()
	mux.Handle("/hub/interop/teams", &interopTeamHandler{server: s})       // get info about teams from interop
	mux.Handle("/hub/interop/missions", &interopMissionHandler{server: s}) // get mission from interop using server's mission ID
	mux.Handle("/hub/interop/telemetry", &interopTelemHandler{server: s})  // get other teams telem info from interop

	mux.Handle("/hub/mission/id", &missionHandler{server: s}) // GET: get current id we're using
	mux.Handle("/hub/mission/initialize", &missionHandlerInitialize{server: s})
	mux.Handle("/hub/mission/start", &missionHandlerStart{server: s, waypointChan: sendWaypointToPlaneChannel})

	mux.Handle("/hub/path", &pathCacherHandler{server: s})

	mux.Handle("/hub/plane/home", &planeHomeHandler{server: s})
	mux.Handle("/hub/plane/telemetry", &planeTelemetryHandler{server: s, uri: influxdbURI, token: influxToken, bucket: influxBucket, org: influxOrg})

	mux.Handle("/hub/interop/odlc/", &interopOdlcHandler{server: s})
	mux.Handle("/hub/interop/odlcs", &interopOdlcsHandler{server: s})
	mux.Handle("/hub/interop/odlc/image/", &interopOdlcImageHandler{server: s})

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

func (s *Server) ConnectToRTPP(channel chan *pp.Client) {
	s.pathPlanningClient = <-channel
	Log.Info("Server client object initialized: RTPP fully connected.")
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
	ID int `json:"id,omitempty"`
}

func (m *missionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	switch r.Method {
	case "GET":
		idData, err := json.Marshal(m.server.missionID)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			//w.Write(err.Message)
		} else {
			w.Write(idData)
			Log.Infof("Successfully retrieved mission ID information: id = %d", m.server.missionID)
		}

	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not implemented"))
	}
}

type missionHandlerInitialize struct {
	server *Server
}

func (m missionHandlerInitialize) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	//cut path_plan/initialize code
	logRequestInfo(r)

	if m.server.pathPlanningClient == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Path Planning connection not established"))
		Log.Errorf("Unable to get data from Path Planning; connection not established")
		return
	}

	switch r.Method {
	case "POST":
		//use post function from pp client
		missionID, _ := ioutil.ReadAll(r.Body) //reads mission ID from post request body
		//err := ic.NewInteropError()

		var id MissionID
		jsonErr := json.Unmarshal(missionID, &id)

		if jsonErr != nil {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte(jsonErr.Error()))
			w.Write(missionID)
			break
		}

		m.server.missionID = id
		fmt.Println(id.ID)

		missionData, err := m.server.client.GetMission(id.ID) //gets mission data from interop server

		if err.Post {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to send data to path planning: %s", err.Message)
			break
		} else {
			Log.Infof("Successfully requested mission information from interop")
		}

		ppErr := m.server.pathPlanningClient.PostMission(missionData) //calls pp client post function

		if ppErr.Post {
			w.WriteHeader(ppErr.Status)
			w.Write(ppErr.Message)
			Log.Errorf("Unable to post mission data to path planning: %s", ppErr.Message)
			break
		}

		//copied path_plan/plath code for 3d sub bullet

		//Make the GET request to the PathPlan Server
		//path, err := json.Marhsall(p.path.Waypoint)
		path, pathBinary, err := m.server.pathPlanningClient.GetPath()
		if err.Get {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
		} else {
			m.server.path = &path //caching the path
			w.Write(pathBinary)
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not implemented"))
	}
}

//Sends waypoints to the plane
type missionHandlerStart struct {
	server       *Server
	waypointChan chan *pp.Path
}

func (m missionHandlerStart) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	switch r.Method {
	case "POST":
		{
			// sends waypoints from path planning to a waypoint channel (which will be transmitted to the plane)
			m.waypointChan <- m.server.path
			message := fmt.Sprintf("Attempting to send %d waypoints to plane", len(m.server.path.GetPath()))
			w.Write([]byte(message))
			Log.Info(message)
		}
	default:
		{
			w.WriteHeader(http.StatusNotImplemented)
			w.Write([]byte("Not implemented"))
		}
	}
}

type pathCacherHandler struct {
	server *Server
}

func (m pathCacherHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	switch r.Method {
	case "GET":
		{
			// sends waypoints from path planning to a waypoint channel (which will be transmitted to the plane)
			message := fmt.Sprintf("%t\n", m.server.path.PlaneAcknowledged)
			w.Write([]byte(message))
			Log.Info(message)
		}
	default:
		{
			w.WriteHeader(http.StatusNotImplemented)
			w.Write([]byte("Not implemented"))
		}
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

// Handles GET requests that ask for our Plane's telemetry data
type planeTelemetryHandler struct {
	server *Server
	uri    string
	token  string
	org    string
	bucket string
}

func (t *planeTelemetryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	switch r.Method {
	case "GET":
		client := influxdb2.NewClient(t.uri, t.token)
		queryAPI := client.QueryAPI(t.org)
		id := r.URL.Query().Get("id")
		fieldsSeparatedByCommas := r.URL.Query().Get("field")
		if id == "" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Missing id parameter"))
			break
		}
		if fieldsSeparatedByCommas == "" {
			w.WriteHeader(http.StatusBadRequest)
			w.Write([]byte("Missing field parameter"))
			break
		}
		// split up the field param by comma
		// fields is an array where each index is a value we want to get from the database
		fields := strings.Split(fieldsSeparatedByCommas, ",")
		// each fieldString is a query string with one of the fields from fields
		queryStrings := []string{}
		for _, f := range fields {
			Log.Infof("current f: %s", f)
			queryStrings = append(queryStrings,
				fmt.Sprintf(`from(bucket:"%s")|> range(start: -5m) |> filter(fn: (r) => r.ID == "%s") |> filter(fn: (r) => r._field == "%s")`,
					t.bucket, id, f))
		}
		// Go through the query strings we made and put them in this results slice
		// results := []influxdb2.QueryTableResult{}
		var results []string
		for _, queryString := range queryStrings {
			result, err := queryAPI.Query(context.Background(), queryString)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(fmt.Sprintf("Error Querying InfluxDB: %s", err)))
				return
			} else {
				if result.Next() {
					results = append(results, fmt.Sprint(result.Record().Value()))
				} else {
					w.WriteHeader(http.StatusBadRequest)
					w.Write([]byte(fmt.Sprintf("Requested telemetry with query %s not found in InfluxDB. Check the id and field in the Mavlink documentation at http://mavlink.io/en/messages/common.html", queryString)))
					return
				}
			}
		}
		jsonMap := make(map[string]interface{})
		for i, field := range fields {
			jsonMap[field] = results[i]
		}
		jsonStr, _ := json.Marshal(jsonMap)
		w.Write([]byte(jsonStr))

		client.Close()
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

func (o *interopOdlcHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	if o.server.client == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Interop connection not established"))
		Log.Errorf("Unable to get odlc data from Interop because connection to Interop not established")
		return
	}

	splitURI := strings.Split(r.URL.Path, "/")
	odlcID, _ := strconv.Atoi(splitURI[len(splitURI)-1])

	switch r.Method {
	case "GET":
		odlcData, intErr := o.server.client.GetODLC(odlcID)
		if intErr.Get {
			w.WriteHeader(intErr.Status)
			w.Write(intErr.Message)
			Log.Errorf("Unable to retrieve ODLC %d from Interop: %s", odlcID, intErr.Message)
		} else {
			// Everything is OK!
			// This Write statment corresponds to a successful GET request in the format:
			// GET /interop/odlcs/X where X is a valid integer
			w.Write(odlcData)
			Log.Infof("Successfully retrieved ODLC %d from Interop", odlcID)
		}
	case "PUT":
		odlcData, _ := ioutil.ReadAll(r.Body)
		updatedOdlc, err := o.server.client.PutODLC(odlcID, odlcData)
		if err.Put {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to update ODLC %d on Interop: %s", odlcID, err.Message)
		} else {
			// This Write statement corresponds to a successful PUT request in the format:
			// PUT /interop/odlcs/X where X is a valid integer
			w.Write(updatedOdlc)
			Log.Infof("Successfully updated ODLC %d on Interop", odlcID)
		}
	case "DELETE":
		err := o.server.client.DeleteODLC(odlcID)
		if err.Delete {
			w.WriteHeader(err.Status)
			w.Write(err.Message)
			Log.Errorf("Unable to delete ODLC %d on Interop: %s", odlcID, err.Message)
		} else {
			// This Write statement corresponds to a successful DELETE request in the format:
			// DELETE /interop/odlcs/X where X is a valid integer
			w.Write([]byte(fmt.Sprintf("Successfully deleted odlc %d", odlcID)))
			Log.Infof("Successfuly deleted ODLC %d on Interop", odlcID)
		}
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

//Handles requests for multiple odlcs
type interopOdlcsHandler struct {
	server *Server
}

func (o *interopOdlcsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	if o.server.client == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Interop connection not established"))
		Log.Errorf("Unable to get odlc data from Interop because connection to Interop not established")
		return
	}

	switch r.Method {
	case "GET":
		odlcsData, intErr := o.server.client.GetODLCs(-1)
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
	case "POST":
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
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
}

//Handles requests for odlc images
type interopOdlcImageHandler struct {
	server *Server
}

func (o *interopOdlcImageHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	if o.server.client == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Interop connection not established"))
		Log.Errorf("Unable to get odlc data from Interop because connection to Interop not established")
		return
	}

	splitURI := strings.Split(r.URL.Path, "/")
	missionID, _ := strconv.Atoi(splitURI[5])

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

/*
Use path planning client to send the static mission data to path planning when Hub receives a POST request
at /hub/pathplanning/initialize with the following request body { "id": [mission_id] }.
Then should use the path planning client to forward the static mission data to path planning
*/
