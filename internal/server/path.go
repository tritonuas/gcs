package server

import (
	"encoding/json"
	"fmt"
)

/*
FORMAT FOR A WAYPOINT SENT FROM PATHPLANNING:
{
	"latitude": val,
	"longitude": val,
	"altitude": val
}
*/

// Waypoint provides an easy way to parse the JSON sent by Path planning into separate
// waypoints
type Waypoint struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Altitude  float64 `json:"altitude"`
}

// String converts the waypoint to a string representation in the format
// (lat, long, alt)
func (w *Waypoint) String() string {
	return fmt.Sprintf("(%f, %f, %f)", w.Latitude, w.Longitude, w.Altitude)
}

// Path essentially is a list of Waypoints that the represent the Plane's path
type Path struct {
	// This list of Waypoints will be structured where the two front waypoints in the
	// list will be the 2 waypoints that are uploaded to the plane. Every waypoint
	// after the front 2 will be waypoints that are stored in Hub, but haven't been
	// sent to the plane.
	waypoints []Waypoint
}

// CreatePath takes in the raw JSON list of waypoints, and converts it to a
// Path struct which has a list of the waypoints stored as instances of the
// Waypoint struct
func CreatePath(waypointsJSON []byte) (*Path, error) {
	var wps []Waypoint

	err := json.Unmarshal(waypointsJSON, &wps)

	if err != nil {
		Log.Debugf("Error: %s", err.Error())
	}

	Log.Debugf("About to return a path")

	//var path *Path = new(Path)
	//path.waypoints = wps

	path := &Path{waypoints: wps}

	Log.Debug(path)
	return path, err
}

// Display writes the list of waypoints to the console for debugging purposes
func (p *Path) Display() {
	for i, wpt := range p.waypoints {
		Log.Debugf("Waypoint %d: %s", i, wpt.String())
	}
}
