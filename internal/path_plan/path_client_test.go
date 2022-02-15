package path_plan

import (
	"bytes"
	"encoding/json"
	"fmt"
	"testing"
	"io/ioutil"
)

var client *Client

//essentially figure out how to make a mission struct. probably going to spend the time at the meeting working on it
type Mission struct{
	id int32 `json:"id"`
	lostCommsPos []LostCommsPos `json:"lostCommsPos"`
}
type LostCommsPos struct{
	latitude float64 `json:"latitude"`
	longitude	float64 `json:"longitude"`
}

func TestNewClient(t *testing.T) {
	client, err := NewClient("127.0.0.1:8000",10)
	
	if err.Post {
			t.Error("Expected successful login, but login was unsuccessful.")
	}
}

func TestPostMission(t *testing.T){
	//variables of mission here
	file, _ := ioutil.ReadFile("2020-test-mission.json")
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