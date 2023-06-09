package pp

import (
	"encoding/json"

	Log "github.com/sirupsen/logrus"
)

// MavlinkConnection handles connection between the OBC and the Pixhawk
type MavlinkConnection struct {
	IP string `json:"ip"`
}

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
	Altitude     float64 `json:"altitude"`      // 200-400 feet?
	Heading      float64 `json:"heading"`       // degrees
	AcceptRadius float64 `json:"accept-radius"` // 0-20 meters
}

// Path stores the waypoints of the mission the plane should fly and
// if the plane has received the mission.
type Path struct {
	Waypoints         []Waypoint
	PlaneAcknowledged bool
}

/*
Make generic coordinate struct
*/
type Coordinate struct {
	Latitude  float64 `json:"latitude,omitempty"`
	Longitude float64 `json:"longitude,omitempty"`
}

// This will be passed to the OBC with the points representing the flight and search boundaries
type Mission struct {
	FlightBoundaries []Coordinate `json:"flight_boundaries"`
	SearchBoundaries []Coordinate `json:"search_boundaries"`
	Obstacles        []Obstacle   `json:"obstacles"`
}

// This will be passed to the OBC (path planning specifically) with the coordinates of obstacles
type Obstacle struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Radius    float64 `json:"radius"`
	Height    float64 `json:"height"`
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
