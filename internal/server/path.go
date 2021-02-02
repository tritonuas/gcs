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
	waypoints []*Waypoint

	// This stores the current index of the waypoint the plane is currently heading
	// towards. This and the following waypoint should be uploaded to the plane
	currIndex int

	// We store the original JSON data so that it can be easily retrieved by a
	// GET request to /plane/path
	jsonSource []byte
}

// CreatePath takes in the raw JSON list of waypoints, and converts it to a
// Path struct which has a list of the waypoints stored as instances of the
// Waypoint struct
func CreatePath(waypointsJSON []byte) (*Path, error) {
	var wps []*Waypoint

	err := json.Unmarshal(waypointsJSON, &wps)

	if err != nil {
		Log.Debugf("Error: %s", err.Error())
	}

	Log.Debugf("About to return a path")

	path := &Path{waypoints: wps, currIndex: 0, jsonSource: waypointsJSON}

	Log.Debug(path)
	return path, err
}

// AdvanceWaypoint increases the counter for the current waypoint, which effects
// which waypoints GetPlaneWaypoints will return
func (p *Path) AdvanceWaypoint() {
	p.currIndex++
}

// GetPlaneWaypoints returns the frontmost two waypoints, which are the waypoints which should
// always be uploaded to the plane
func (p *Path) GetPlaneWaypoints() (*Waypoint, *Waypoint) {
	if p.currIndex+1 < len(p.waypoints) { // There are at least 2 more waypoints in the list
		return p.waypoints[p.currIndex], p.waypoints[p.currIndex+1]
	} else if p.currIndex+1 == len(p.waypoints) { // There is only 1 more waypoing in the list
		return p.waypoints[p.currIndex], nil
	} else { // We have reached the end of the waypoints list
		return nil, nil
	}
}

// GetOriginalJSON returns the original JSON encoding of the path
func (p *Path) GetOriginalJSON() []byte {
	return p.jsonSource
}

// Display writes the list of waypoints to the console for debugging purposes
func (p *Path) Display() {
	for i, wpt := range p.waypoints {
		Log.Debugf("Waypoint %d: %s", i, wpt.String())
	}
}
