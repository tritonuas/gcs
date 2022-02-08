package path_plan

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"testing"
)

var client *Client

func TestNewClient(t *testing.T) {
	client, err := NewClient("127.0.0.1:8000",10)
	
	if err.Post {
			t.Error("Expected successful login, but login was unsuccessful.")
	}
}

func TestPostMission(t *testing.T){
	//variables of mission here
	mission := Mission{
		//add structure for mission here
	}
	missionJSON = json.Marshal(mission)
	err :=  client.PostMission(missionJSON)
	if err.Post {
		t.Error("Expected post error to be false, but was true.")
	}
}
func TestBadPostMission(t *testing.T){
	//bad variable of mission here
	mission := Mission{
		//add structure for mission here
	}
	missionJSON = json.Marshal(mission)
	err :=  client.PostMission(missionJSON)
	if !err.Post {
		t.Error("Expected post error to be true, but was false.")
	}
}

func TestGetPath(t *testing.T){
	path, err := client.GetPath()
	//not too sure how to test for improper lattitude, longitude, altitude, and heading
	if err.Get {
		t.Error("Get Error")
	}
}