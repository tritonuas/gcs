package manager

import (
	"time"
)

/*
This is an enumerated class (enum class) which enumerates all of the possible states our mission can be in.
These are used to track the current status of our mission and determine what logic should be run.
*/
type State int

const (
	// On the Ground
	Dormant State = iota // We haven't made an initial connection to the plane
	Unarmed              // The plane is on the ground, but not armed
	Armed                // The plane is on the ground and armed. Ready for takeoff

	// In Flight
	Takeoff         // The plane is taking off but hasn't started on waypoints yet
	Waypoint        // The plane is flying its initial waypoint path
	Search          // The plane is either going towards the search zone or covering it
	CVLoiter        // The plane is loitering outside the search zone waiting for all the results from CV
	AirdropApproach // The plane is approaching an airdrop point
	AirdropLoiter   // The plane is loitering outside the search zone waiting for 15s buffer to pass
	Landing         // The plane is approaching for a landing
)

var toString = map[State]string{
	Dormant:         "DORMANT",
	Unarmed:         "UNARMED",
	Armed:           "ARMED",
	Takeoff:         "TAKEOFF",
	Waypoint:        "WAYPOINT",
	Search:          "SEARCH",
	CVLoiter:        "CV LOITER",
	AirdropApproach: "AIRDROP APPROACH",
	AirdropLoiter:   "AIRDROP LOITER",
	Landing:         "LANDING",
}
var toID = map[string]State{
	"DORMANT":          Dormant,
	"UNARMED":          Unarmed,
	"ARMED":            Armed,
	"TAKEOFF":          Takeoff,
	"WAYPOINT":         Waypoint,
	"SEARCH":           Search,
	"CV LOITER":        CVLoiter,
	"AIRDROP APPROACH": AirdropApproach,
	"AIRDROP LOITER":   AirdropLoiter,
	"LANDING":          Landing,
}

/*
String conversions so we can send current state around the network
*/
func (state State) String() string {
	return toString[state]
}

/*
Should load POST request's JSON into this struct, then to the enum class
*/
type StateJSON struct {
	State string `json:"state"`
}

/*
ToEnum converts a StateJSON to the enum form
*/
func (sj StateJSON) ToEnum() State {
	return toID[sj.State]
}

/*
This keeps track of state changes so we can have a history of the mission's progress
*/
type StateChange struct {
	Prev State     `json:"prev"` // The previous state
	New  State     `json:"new"`  // The new state
	Time time.Time `json:"time"` // The time at which the change occurred
}

/*
This map says what state changes are valid
s2     in valid[s1] means that s1 -> s2 is a valid state change
s2 not in valid[s1] means that s1 -> s2 is not a valid state change
*/
var valid = map[State][]State{
	Dormant:         {Unarmed},
	Unarmed:         {Armed, Dormant},
	Armed:           {Unarmed, Takeoff},
	Takeoff:         {Waypoint, Landing},
	Waypoint:        {Search, CVLoiter, AirdropApproach, Landing},
	Search:          {CVLoiter, Landing},
	CVLoiter:        {Search, AirdropApproach, Landing},
	AirdropApproach: {AirdropLoiter, Landing},
	AirdropLoiter:   {AirdropApproach, Landing},
	Landing:         {Armed, Waypoint, Search, CVLoiter, AirdropApproach},
}

/*
Check if a state transition is valid.
*/
func isValid(prev State, new State) bool {
	for _, state := range valid[prev] {
		if state == new {
			return true
		}
	}
	return false
}

/*
Uses the valid map to create a state change object and determine if it is valid
Returns nil if the state change is not valid
*/
func NewStateChange(prev State, new State) *StateChange {
	if !isValid(prev, new) {
		return nil
	}

	return &StateChange{prev, new, time.Now()}
}
