package path_plan

import (
	"encoding/json"
)



/*
FORMAT FOR A WAYPOINT SENT FROM PATHPLANNING:
{
	"latitude": val,
	"longitude": val,
	"altitude": val,
	"heading:" val
}
*/

// Waypoint provides an easy way to parse the JSON sent by Path planning into separate
// waypoints
type Waypoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Altitude  float64 `json:"altitude"`
	Heading   float64 `json:"heading"`
}

//My implementation of a path struct in here not too sure if it should be a float64 slice or a waypoint slice

type Path struct{
	waypoints []Waypoint 
}

func CreatePath(waypointsIn []byte) (Path){
	var wpts []Waypoint
	err := json.Unmarshal([]byte(waypointsIn), &wpts)
	if err !=nil {
		Log.Fatal(err)
	}
	path := Path{
		waypoints: wpts,
	}
	return path 
}



// 1. learn about json tags, how to use with json.Marshal, json.Unmarshal
// 2. see server.go run method