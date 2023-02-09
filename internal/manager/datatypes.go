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
	DORMANT  State = iota // We haven't made an initial connection to the plane
	UNARMED               // The plane is on the ground, but not armed
	ARMED                 // The plane is on the ground and armed. Ready for takeoff

	// In Flight
	TAKEOFF               // The plane is taking off but hasn't started on waypoints yet
	WAYPOINT              // The plane is flying its initial waypoint path
	SEARCH                // The plane is either going towards the search zone or covering it
	CV_LOITER             // The plane is loitering outside the search zone waiting for all the results from CV
	AIRDROP_APPROACH      // The plane is approaching an airdrop point
	AIRDROP_LOITER        // The plane is loitering outside the search zone waiting for 15s buffer to pass
	LANDING               // The plane is approaching for a landing
)

var toString = map[State]string {
	DORMANT:          "DORMANT",
	UNARMED:          "UNARMED",
	ARMED:            "ARMED",
	TAKEOFF:          "TAKEOFF",
	WAYPOINT:         "WAYPOINT",
	SEARCH:           "SEARCH",
	CV_LOITER:        "CV LOITER",
	AIRDROP_APPROACH: "AIRDROP APPROACH",
	AIRDROP_LOITER:   "AIRDROP LOITER",
	LANDING:          "LANDING",
}
var toID = map[string]State {
	"DORMANT":          DORMANT,
	"UNARMED":          UNARMED,
	"ARMED":            ARMED,
	"TAKEOFF":          TAKEOFF,
	"WAYPOINT":         WAYPOINT,
	"SEARCH":           SEARCH,
	"CV LOITER":        CV_LOITER,
	"AIRDROP APPROACH": AIRDROP_APPROACH,
	"AIRDROP LOITER":   AIRDROP_LOITER,
	"LANDING":          LANDING,
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

func (sj StateJSON) ToEnum() State {
	return toID[sj.State]
}

/*
	This keeps track of state changes so we can have a history of the mission's progress
*/
type StateChange struct {
	prev State     `json:"prev"` // The previous state
	new  State     `json:"new"` // The new state
	time time.Time `json:"time"` // The time at which the change occurred
}

/*
	This map says what state changes are valid
	s2     in valid[s1] means that s1 -> s2 is a valid state change
	s2 not in valid[s1] means that s1 -> s2 is not a valid state change
*/
var valid = map[State][]State {
	DORMANT: []State{UNARMED},
	UNARMED: []State{ARMED, DORMANT},
	ARMED:   []State{UNARMED, TAKEOFF},
	TAKEOFF: []State{WAYPOINT, LANDING},
	WAYPOINT:[]State{SEARCH, CV_LOITER, AIRDROP_APPROACH, LANDING},
	SEARCH:  []State{CV_LOITER, LANDING},
	CV_LOITER: []State{SEARCH, AIRDROP_APPROACH, LANDING},
	AIRDROP_APPROACH: []State{AIRDROP_LOITER, LANDING},
	AIRDROP_LOITER: []State{AIRDROP_APPROACH, LANDING},
	LANDING: []State{ARMED, WAYPOINT, SEARCH, CV_LOITER, AIRDROP_APPROACH},
}
/*
	Check if a state transition is valid.
*/
func isValid(prev State, new State) bool {
	for _, state := range valid[prev]{
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