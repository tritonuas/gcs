package server

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/rs/cors"
	"github.com/sirupsen/logrus"

	cv "github.com/tritonuas/hub/internal/computer_vision"
	ic "github.com/tritonuas/hub/internal/interop"

	// mav "github.com/tritonuas/hub/internal/mavlink"
	pp "github.com/tritonuas/hub/internal/path_plan"
	ut "github.com/tritonuas/hub/internal/utils"
)

var Log = logrus.New()

// https://app.clickup.com/t/28rwhv5

// Server provides the implementation for the hub server that communicates
// with other parts of the plane's system and houston
type Server struct {
	port               string
	client             *ic.Client
	pathPlanningClient *pp.Client
	cvData             *cv.ComputerVisionData

	telemetry []byte // Holds the most recent telemetry data sent to the interop server

	path *pp.Path // Holds the path of the plane, see the definition of the struct for more details

	homePosition *ic.Position // Home position of the plane, which must be set by us

	missionID MissionID

	gcsWaypoint map[string]float64

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

	// receives "true" when the mission is started
	missionStartChannel := make(chan bool)

	s.missionID = MissionID{ID: interopMissionID}

	s.pathPlanningClient = pp.NewClient("127.0.0.1:5000", 5)

	s.cvData = cv.InitializeData()

	s.port = fmt.Sprintf(":%s", port)
	s.client = nil
	go s.ConnectToInterop(interopChannel)
	go s.ConnectToRTPP(rtppChannel)
	mux := http.NewServeMux()
	mux.Handle("/hub/gcs", &gcsPositionHandler{server: s, uri: influxdbURI, token: influxToken, bucket: influxBucket, org: influxOrg})

	mux.Handle("/hub/interop/teams", &interopTeamHandler{server: s})       // get info about teams from interop
	mux.Handle("/hub/interop/missions", &interopMissionHandler{server: s}) // get mission from interop using server's mission ID
	mux.Handle("/hub/interop/telemetry", &interopTelemHandler{server: s})  // get other teams telem info from interop

	mux.Handle("/hub/mission/id", &missionHandler{server: s}) // GET: get current id we're using
	mux.Handle("/hub/mission/initialize", &missionHandlerInitialize{server: s})
	mux.Handle("/hub/mission/start", &missionHandlerStart{server: s, waypointChan: sendWaypointToPlaneChannel, missionStartChan: missionStartChannel})

	mux.Handle("/hub/path", &pathCacherHandler{server: s})

	mux.Handle("/hub/plane/home", &planeHomeHandler{server: s})
	mux.Handle("/hub/plane/telemetry", &planeTelemetryHandler{server: s, uri: influxdbURI, token: influxToken, bucket: influxBucket, org: influxOrg})

	mux.Handle("/hub/interop/odlc/", &interopOdlcHandler{server: s})
	mux.Handle("/hub/interop/odlcs", &interopOdlcsHandler{server: s})
	mux.Handle("/hub/interop/odlc/image/", &interopOdlcImageHandler{server: s})

	mux.Handle("/hub/cv/cropped/", &CVCroppedHandler{server: s, uri: influxdbURI, token: influxToken, bucket: influxBucket, org: influxOrg}) // eventually these influx variables will be in an influxclient struct
	mux.Handle("/hub/cv/result/", &CVResultHandler{server: s})

	c := cors.New(cors.Options{
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE"},
	})

	go s.CacheAndUploadTelem(influxdbURI, influxToken, influxBucket, influxOrg, missionStartChannel)
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

// CacheAndUploadTelem queries the database for telemetry and posts it to the interop server
func (s *Server) CacheAndUploadTelem(uri string, token string, bucket string, org string, missionStartChannel chan bool) {
	client := influxdb2.NewClient(uri, token)
	queryAPI := client.QueryAPI(org)

	latQueryString := fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "lat")`, bucket)
	lonQueryString := fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "lon")`, bucket)
	altQueryString := fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "alt")`, bucket)
	hdgQueryString := fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "hdg")`, bucket)

	queryStrings := make([]string, 4)
	queryStrings[0] = latQueryString
	queryStrings[1] = lonQueryString
	queryStrings[2] = altQueryString
	queryStrings[3] = hdgQueryString

	fields := make([]string, 4)
	fields[0] = "latitude"
	fields[1] = "longitude"
	fields[2] = "altitude"
	fields[3] = "heading"

	Log.Info("Waiting for mission to start to begin uploaded telemetry to the interop server.")
	_ = <-missionStartChannel
	Log.Info("Mission has been started so we will begin to upload telemetry to the interop server.")

loop:
	for true {
		// Note: this code is basically copied from /hub/plane/telemetry endpoint.
		// In the future we should abstract out this logic into a separate module that just deals with interfacing with the influx db
		// so that this code and the code in /hub/plane/telemtry just uses this module instead of having to do the dirty work itself
		var results []string
		for _, queryString := range queryStrings {
			result, err := queryAPI.Query(context.Background(), queryString)
			if err != nil {
				Log.Errorf("Error querying Influx for telemetry data: %s ", err.Error())
				continue loop
			} else {
				if result.Next() {
					val := fmt.Sprint(result.Record().Value())
					results = append(results, val)
				} else {
					Log.Errorf("Error querying Influx for telemetry data: no value found ", err.Error())
					continue loop
				}
			}
		}
		jsonMap := make(map[string]float64)
		for i, field := range fields {
			val, _ := strconv.ParseFloat(results[i], 64)
			if field == "latitude" || field == "longitude" {
				val /= 1e7
			}
			if field == "altitude" {
				val /= 1000
			}
			if field == "heading" {
				val /= 100
			}
			jsonMap[field] = val
		}

		jsonStr, _ := json.Marshal(jsonMap)

		// TODO: consider putting a rate limit on this so we don't spam the interop server?
		if s.client != nil && s.client.IsConnected() {
			s.client.PostTelemetry(jsonStr)
		}

		time.Sleep(500 * time.Millisecond)
	}
}

func logRequestInfo(r *http.Request) {
	Log.Infof("Request to Hub from %s: %s %s", r.RemoteAddr, r.Method, r.URL)
}

type gcsPositionHandler struct {
	server *Server
	uri    string
	token  string
	org    string
	bucket string
}

func (m *gcsPositionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	switch r.Method {
	case "POST":
		client := influxdb2.NewClient(m.uri, m.token)
		queryAPI := client.QueryAPI(m.org)

		latQueryString := fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "lat")`, m.bucket)
		lonQueryString := fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "lon")`, m.bucket)

		queryStrings := make([]string, 2)
		queryStrings[0] = latQueryString
		queryStrings[1] = lonQueryString

		fields := make([]string, 2)
		fields[0] = "latitude"
		fields[1] = "longitude"

		// Log.Info("Waiting for mission to start to begin uploaded telemetry to the interop server.")
		// _ = <-m.server.missionStartChannel
		// Log.Info("Mission has been started so we will begin to upload telemetry to the interop server.")

		// Note: this code is basically copied from /hub/plane/telemetry endpoint.
		// In the future we should abstract out this logic into a separate module that just deals with interfacing with the influx db
		// so that this code and the code in /hub/plane/telemtry just uses this module instead of having to do the dirty work itself
		var results []string
		for _, queryString := range queryStrings {
			result, err := queryAPI.Query(context.Background(), queryString)
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(fmt.Sprintf("Error Querying InfluxDB: %s", err)))
				return
			} else {
				if result.Next() {
					val := fmt.Sprint(result.Record().Value())
					results = append(results, val)
				} else {
					w.WriteHeader(http.StatusBadRequest)
					w.Write([]byte(fmt.Sprintf("Requested telemetry with query %s not found in InfluxDB. Check the id and field in the Mavlink documentation at http://mavlink.io/en/messages/common.html", queryString)))
					return
				}
			}
		}
		jsonMap := make(map[string]float64)
		for i, field := range fields {
			val, _ := strconv.ParseFloat(results[i], 64)
			if field == "latitude" || field == "longitude" {
				val /= 1e7
			}
			jsonMap[field] = val
		}

		m.server.gcsWaypoint = jsonMap
		client.Close()
	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not Implemented"))
	}
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
	server           *Server
	waypointChan     chan *pp.Path
	missionStartChan chan bool
}

func (m missionHandlerStart) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)
	switch r.Method {
	case "POST":
		{
			// sends waypoints from path planning to a waypoint channel (which will be transmitted to the plane)
			m.waypointChan <- m.server.path
			m.missionStartChan <- true
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
			if m.server.path == nil {
				errMsg := "Path has not been initialized yet"
				Log.Error(errMsg)
				w.Write([]byte(errMsg))
				break
			}
			data, err := json.Marshal(m.server.path.Waypoints)
			if err != nil {
				Log.Error(err)
				w.Write([]byte(err.Error()))
			}
			w.Write(data)
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
				fmt.Sprintf(`from(bucket:"%s") |> range(start: -5m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "%s") |> filter(fn: (r) => r._field == "%s")`,
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
					val := fmt.Sprint(result.Record().Value())
					results = append(results, val)
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

// Handles requests from the jetson that include the cropped/salienced image
type CVCroppedHandler struct {
	server *Server
	uri    string
	token  string
	org    string
	bucket string
}

// TODO: extremely scuffed code that needs refactoring. need to make a CVS and
// OBC client
func (h CVCroppedHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	if h.server.cvData == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Computer Vision Server connection not established"))
		Log.Errorf("Unable to receive data from CVS; connection not established")
		return
	}

	switch r.Method {
	case "POST":
		var t cv.UnclassifiedODLC
		bodyData, _ := ioutil.ReadAll(r.Body)
		err := json.Unmarshal(bodyData, &t)
		if err != nil {
			Log.Fatal(err)
		}

		client := influxdb2.NewClient(h.uri, h.token)
		queryAPI := client.QueryAPI(h.org)
		Log.Info("Queryapi", queryAPI)

		telem := make(map[string]float64)
		fields := []string{"lat", "lon", "relative_alt", "hdg"}
		for _, field := range fields {
			planeLatQuery := fmt.Sprintf(`from(bucket:"%s") |> range(start: %s) |> filter(fn: (r) => r.ID == "33") |> filter(fn: (r) => r._field == "%s") |> first()`, h.bucket, t.Timestamp, field)
			result, err := queryAPI.Query(context.Background(), planeLatQuery)
			if err != nil {
				Log.Error(err)
			}
			if result != nil && result.Next() {
				var ok bool
				telem[field], ok = result.Record().Value().(float64)
				if !ok {
					telem[field] = 0
					Log.Error("Could not parse %s from InfluxDB")
				}
			} else {
				Log.Debug("Could not find %s field in InfluxDB", field)
			}
		}
		t.PlaneLat = telem[fields[0]] / 1e7
		t.PlaneLon = telem[fields[1]] / 1e7
		t.PlaneAlt = telem[fields[2]] / 1000
		t.PlaneHead = telem[fields[3]] / 100

		data, err := json.Marshal(t)
		if err != nil {
			Log.Error(err)
			w.Write([]byte(err.Error()))
			break
		}
		Log.Info("this print statement v")
		Log.Info(t.PlaneLat)
		Log.Info(t.PlaneLon)
		Log.Info(t.PlaneAlt)
		Log.Info(t.PlaneHead)
		//Log.Info(string(data))
		// resp, err := http.Post("http://localhost:5040/upload", "application/json", bytes.NewBuffer(data))
		httpClient := ut.NewClient("172.17.0.1:5040", 30) // TODO: change this to be env variable
		// TODO: also make a CVS client (maybe OBC client as well)
		_, httpErr := httpClient.Post("/upload", bytes.NewBuffer(data))
		if httpErr.Post {
			Log.Error("failed to post cropped target to CVS: ", string(httpErr.Message))
			return
		}

	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not implemented"))
	}
}

// Handles requests from the computer vision server with the predicted results
type CVResultHandler struct {
	server *Server
}

func (h CVResultHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	logRequestInfo(r)

	if h.server.cvData == nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Computer Vision Server connection not established"))
		Log.Errorf("Unable to receive data from CVS; connection not established")
		return
	}

	switch r.Method {
	case "POST":
		imageData, _ := ioutil.ReadAll(r.Body)

		var image cv.ClassifiedODLC

		// unmarshal posted image data and store into image (classified ODLC struct)
		err := json.Unmarshal(imageData, &image)
		if err != nil {
			Log.Error("error unmarshalling image data: ", err)
			return
		}
		h.server.cvData.ClassifiedODLCs = append(h.server.cvData.ClassifiedODLCs, image) // saves unmarshalled data to list of cv images

		var odlc ic.Odlc

		// assign values to odlc struct
		var missionID = int32(h.server.missionID.ID)
		odlc.Mission = &missionID
		var odlcType = ic.Odlc_STANDARD
		odlc.Type = &odlcType
		odlc.Latitude = &image.Latitude
		odlc.Longitude = &image.Longitude
		odlc.Orientation = ic.Odlc_Orientation(ic.Odlc_Orientation_value[image.Orientation]).Enum()
		odlc.Shape = ic.Odlc_Shape(image.Shape).Enum()
		odlc.Alphanumeric = &image.Char
		odlc.ShapeColor = ic.Odlc_Color(image.ShapeColor).Enum()
		odlc.AlphanumericColor = ic.Odlc_Color(image.CharColor).Enum()
		var autonomous = true
		odlc.Autonomous = &autonomous

		// have to convert the alphanumeric to uppercase because the PostODLC function returns an error otherwise
		image.Char = strings.ToUpper(image.Char)

		// marshal values into json
		jsonStr, _ := json.Marshal(odlc)

		// gets a json of the same odlc returned with the id
		jsonStr, httpErr := h.server.client.PostODLC(jsonStr)
		if httpErr.Post {
			Log.Error("failed to post odlc: ", string(httpErr.Message))
			return
		}
		Log.Info("Posted ODLC to Interop")

		// convert back to odlc
		err = json.Unmarshal(jsonStr, &odlc)
		if err != nil {
			Log.Error(err)
			return
		}

		// decode base64 data into image
		data, err := base64.StdEncoding.DecodeString(image.CroppedImageBase64)
		if err != nil {
			Log.Error("decoding error: ", err)
			return
		}

		// sends odlc with image to server
		httpErr = h.server.client.PutODLCImage(int(*odlc.Id), data)
		if httpErr.Put {
			Log.Error("failed to put odlc: ", httpErr)
			Log.Error("put fail message: ", string(httpErr.Message))
			return
		}
		Log.Info("Put ODLC to Interop")

	default:
		w.WriteHeader(http.StatusNotImplemented)
		w.Write([]byte("Not implemented"))
	}
}
