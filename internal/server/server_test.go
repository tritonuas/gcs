package server

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"
	"image"
	"image/color"
	"image/png"
	ut "github.com/tritonuas/hub/internal/utils"
	ic "github.com/tritonuas/hub/internal/interop"
	pp "github.com/tritonuas/hub/internal/path_plan"
)
//TODO: image comparison 
var server *Server
var client *ut.Client

func TestNewClient(t *testing.T) {
	//copied over from other client testers, put here as a filler, not sure about what the port should be
	client = ut.NewClient("127.0.0.1:5000",10)
}
//Tests the general section of the wiki, by first posting, then retrieving the same value from it
func TestGeneral(t *testing.T) {
	
	postID := MissionID{
		ID: 1,
	}
	postIDjson, _ := json.Marshal(postID)
	_, err := client.Post("/hub/mission", bytes.NewReader(postIDjson))
	if err.Post {
		t.Errorf("Post Error: %s ", err.Message)
	}
	val, err := client.Get("/hub/mission")
	var id MissionID
	jsonErr := json.Unmarshal(val, &id)
	if err.Get {
		t.Error("Get Error")
	}
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if id.ID != 1 {
		t.Error("Not properly posted")
	}
}
//Tests the plane endpoints section of the wiki
func TestPlane(t *testing.T) {
	position, err := client.Get("/hub/plane/position")
	posCheck, ppErr := pp.CreateWaypoint(position)
	//check for waypoint do not know, need to get actual waypoint for this
	if err.Get {
		t.Errorf("Get Error: %s", err.Message)
	}
	if ppErr != nil {
		t.Errorf("JSON Error: %s", ppErr.Error())
	}
	var telemetry []byte 
	telemetry, err = client.Get("/hub/plane/telemetry?id=30&field=yaw")
	var telemCheck pp.Waypoint
	telemCheck, ppErr = pp.CreateWaypoint(telemetry)
	//check for waypoint same problem as 51 
	//this if statement is just here so the tester stops yelling at me in the terminal about unused declared variables
	if telemCheck != posCheck {
		t.Error("This message should appear if everything is actually declared:)")
	}
	if err.Get {
		t.Error("Get Error")
	}
	_, err = client.Post("/hub/plane/home", bytes.NewReader(position))
	if err.Post {
		t.Error("Post Error")
	}
	home, err := client.Get("/hub/plane/home")
	//literally same implemntation as the first since I just reused position
	if err.Get {
		t.Error("Get Error")
	}
	var homeCheck pp.Waypoint
	homeCheck, ppErr = pp.CreateWaypoint(home)
	if homeCheck!=posCheck{
		t.Error("Waypoint not properly posted")
	}
	//------------------------------------------------------------------------
	//Path stuff
	var lat float64 = 38
	var long float64 = -76
	var alt float64 = 100
	var head float64 = 90
	telem := pp.Waypoint{
		Latitude:  lat,
		Longitude: long,
		Altitude:  alt,
		Heading:   head,
	}
	lat = 39
	long = 76
	alt = 101
	head = 91
	telemTwo := pp.Waypoint{
		Latitude:  lat,
		Longitude: long,
		Altitude:  alt,
		Heading:   head,
	}
	wpts := []pp.Waypoint{telem, telemTwo}
	path := pp.Path{
		Waypoints: wpts, 
	}
	pathJSON, _ := json.Marshal(path)
	

	//path should be path not waypoint my bad thats pretty dumb
	_, err = client.Post("/hub/plane/path", bytes.NewReader(pathJSON))
	if err.Post {
		t.Error("Post Error")
	}
	var pathGet []byte
	pathGet, err = client.Get("/hub/plane/path")
	//check for the path values provided 
	pathCheck := pp.CreatePath(pathGet)
	//compares paths should most likely do a loop, instead of literally just checking the second index
	if pathCheck.Waypoints[1] != path.Waypoints[1] {
		t.Error("Path did not properly post")
	}
	if err.Get {
		t.Error("Get Error")
	}
}

func TestInterop(t *testing.T) {
	teams, err := client.Get("/hub/interop/teams")
	var teamList []*ic.TeamStatus
	jsonErr := json.Unmarshal(teams, &teamList)
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if len(teamList) == 0 {
		t.Errorf("Expected length of teams array to be greater than 0, was %d", len(teamList))
	}
	if err.Get {
		t.Error("Get Error")
	}
	missions, err := client.Get("/hub/interop/missions")
	var mission *ic.Mission
	jsonErr = json.Unmarshal(missions, &mission)
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if mission.GetId() != 1 {
		t.Error("expected mission id to be 1")
	}
	if err.Get {
		t.Error("Get Error")
	}
	var lat float64 = 38
	var long float64 = -76
	var alt float64 = 100
	var head float64 = 90
	telem := pp.Waypoint{
		Latitude:  lat,
		Longitude: long,
		Altitude:  alt,
		Heading:   head,
	}
	telemJSON, _ := json.Marshal(telem)
	_, err = client.Post("/hub/interop/telemtry", bytes.NewReader(telemJSON))
	if err.Post {
		t.Error("Post Error")
	}
	telemGet, err := client.Get("/hub/interop/telemtry")
	//json, linked to previous post
	var tel *pp.Waypoint
	jsonErr = json.Unmarshal(telemGet, &tel)
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	//do comparisons of values with the orignal telem 
	if err.Get {
		t.Error("Get Error")
	}
	
	
	//odlcs after this
	//----------------
	//Creating an odlc
	odlcId := int32(25)
	odlcMission := int32(1)
	odlcType := ic.Odlc_STANDARD
	odlcLatitude := float64(50)
	odlcLongitude := float64(-76)
	odlcOrientation := ic.Odlc_N //it said to use varint 6, so that is SW who knows 
	odlcShape :=  ic.Odlc_SQUARE //varint 7
	//confused about alphanumeric implementation tbh
	odlcShapeColor := ic.Odlc_RED //9
	odlcAlphanumericColor := ic.Odlc_RED//10
	//Description and autonomous implementation elude me



	postODLC := &ic.Odlc{
		Mission: 			&odlcMission,
		Type:    			&odlcType,
		Latitude: 			&odlcLatitude, 
		Longitude: 			&odlcLongitude,
		Orientation:		&odlcOrientation, 
		Shape: 				&odlcShape,
		ShapeColor:			&odlcShapeColor,
		AlphanumericColor:	&odlcAlphanumericColor,	
	}

	postOdlcJSON, _ := json.Marshal(postODLC)

	odlcsPost, err := client.Post("/hub/interop/odlcs", bytes.NewReader(postOdlcJSON))
	//make sure that odlcPost has an id, I think we can just compare the odlcs with the odlcs post
	var retOdlcs *ic.Odlc
	jsonErr = json.Unmarshal(odlcsPost, &retOdlcs)
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if err.Post{
		t.Error("Post Error")
	}
	odlcsPostP, err := client.Get("/hub/interop/odlcs")
	var compOdlcs *ic.Odlc
	//one concern is that this is turning a list of odlcs to a singular odlc whcih does not make much sense to me
	jsonErr = json.Unmarshal(odlcsPostP, &compOdlcs)
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if !ic.CompareODLCs(compOdlcs, retOdlcs) {
		t.Error("Odlcs should be the same")
	}
	if err.Get{
		t.Error("Get Error")
	}
	
	
	//odlc after this
	//-----------------
	odlcPost, err := client.Post("/hub/interop/odlc/25", bytes.NewReader(postOdlcJSON))
	//check to see if id is 25 also use this to compare with the get function
	var retOdlc *ic.Odlc
	jsonErr = json.Unmarshal(odlcPost, &retOdlc)
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if retOdlc.GetId() != odlcId {
		t.Error("Posting at id endpoint for an odlc does not work, got wrong id returned")
	}
	if err.Get{
		t.Error("Get Error")
	}
	odlcPostP, err := client.Get("/hub/interop/odlc/1")
	//make sure that odlcPostP is equivalent to odlcPost
	var compOdlc *ic.Odlc
	//one concern is that this is turning a list of odlcs to a singular odlc whcih does not make much sense to me
	jsonErr = json.Unmarshal(odlcPostP, &compOdlc)
	check := ic.CompareODLCs(compOdlc, retOdlc)
	if !check {
		t.Error("Odlcs should be the same")
	}
	if jsonErr != nil {
		t.Errorf("JSON Error: %s", jsonErr.Error())
	}
	if err.Get{
		t.Error("Get Error")
	}
	_, err = client.Delete("/hub/interop/odlc/1")
	if err.Delete{
		t.Error("Delete error")
	}

	//---------------------------------------------------------------------------------------
	//odlc image stuff after this
	// Making a test image using go's image libary
	width := 256
	height := 256
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.NRGBA{
				R: uint8((x + y) & 255),
				G: uint8((x + y) << 1 & 255),
				B: uint8((x + y) << 2 & 255),
				A: 255,
			})
		}
	}
	buff := new(bytes.Buffer)
	png.Encode(buff, img)
	b := []byte(fmt.Sprint(buff))
	_, err = client.Put("/hub/interop/odlc/image/1", bytes.NewReader(b))
	if err.Post{
		t.Error("Post Error")
	}
	// image, err := client.Get("hub/interop/odlc/image/1")
	_, err = client.Get("/hub/interop/odlc/image/1")
	//make sure that b is equivalent to image not too sure how to handle the equivalency of a png though so ...
	if err.Get {
		t.Error("Get Error")
	}
	_, err = client.Delete("/hub/interop/odlc/image/1")
	if err.Delete{
		t.Error("Delete error")
	}
}
