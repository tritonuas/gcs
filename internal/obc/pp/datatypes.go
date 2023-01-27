package pp

import (
	"encoding/json"

	Log "github.com/sirupsen/logrus"
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
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	Altitude     float64 `json:"altitude"`
	Heading      float64 `json:"heading"`
	AcceptRadius float64 `json:"accept-radius"`
}

// Path stores the waypoints of the mission the plane should fly and
// if the plane has received the mission.
type Path struct {
	Waypoints         []Waypoint
	PlaneAcknowledged bool
}

// CreatePath will create a Path struct given some waypoints in
// JSON format.
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

// GetPath
func (p Path) GetPath() []Waypoint {
	return p.Waypoints
}

// 1. learn about json tags, how to use with json.Marshal, json.Unmarshal
// 2. see server.go run method
