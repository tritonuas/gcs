package pp

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
}

// This will be passed to the OBC (path planning specifically) with the coordinates of obstacles
type Obstacle struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Radius    float64 `json:"radius"`
	Height    float64 `json:"height"`
}
