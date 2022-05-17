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
    AcceptRadius float64 `json:"accept-radius"`
}

//My implementation of a path struct in here not too sure if it should be a float64 slice or a waypoint slice

type Path struct {
	Waypoints         []Waypoint
	PlaneAcknowledged bool
}

func CreatePath(waypointsIn []byte) Path {
	var wpts []Waypoint
	err := json.Unmarshal(waypointsIn, &wpts)
	if err != nil {
		Log.Fatal(err)
	}
	path := Path{
		Waypoints: wpts,
	}
	return path
}

func (p Path) GetPath() []Waypoint {
	return p.Waypoints
}

// 1. learn about json tags, how to use with json.Marshal, json.Unmarshal
// 2. see server.go run method
