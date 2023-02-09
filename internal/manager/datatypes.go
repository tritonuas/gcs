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
	state string `json:"state"`
}

func (sj StateJSON) ToEnum() State {
	return toID[sj.state]
}

/*
	This keeps track of state changes so we can have a history of the mission's progress
*/
type StateChange struct {
	prev State     // The previous state
	new  State     // The new state
	time time.Time // The time at which the change occurred
}

/*
	This map says what state changes are valid
	s2     in valid[s1] means that s1 -> s2 is a valid state change
	s2 not in valid[s1] means that s1 -> s2 is not a valid state change
*/
var valid = map[State][]State {
	DORMANT: []State{UNARMED},
}
/*
valid[DORMANT] = [UNARMED]
// You have to be ARMED before TAKEOFF
valid[UNARMED] = [ARMED, DORMANT]
// You either end up on TAKEOFF or going back DORMANT 
valid[ARMED] = [UNARMED, TAKEOFF]
// After taking off you either have to immediately do WAYPOINT (by the rules) or potentially do LANDING early
valid[TAKEOFF] = [WAYPOINT, LANDING]
 // If this isn't the first waypoint run then you could theoretically have already done SEARCH, so you could go straight to AIRDROP
valid[WAYPOINT] = [SEARCH, CV_LOITER, AIRDROP_APPROACH, LANDING]
// After SEARCH, you either have to do CV_LOITER and wait for cv results, or you could potentially need to do LANDING early
valid[SEARCH] [CV_LOITER, LANDING]
// If you didn't find everything in SEARCH, you could potentially go back. Otherwise, either start AIRDROP_APPROACH or do LANDING early
valid[CV_LOITER] = [SEARCH, AIRDROP_APPROACH, LANDING]
// During an approach you'll either succeed or have to divert your path. Either way you enter AIRDROP_LOITER. The only exception is if it
// is the last bottle, which makes you enter LANDING
valid[AIRDROP_APPROACH] = [AIRDROP_LOITER, LANDING]
// Once you're done with AIRDROP_LOITER, you go back to AIRDROP_APPROACH. Or, you do an early LANDING
valid[AIRDROP_LOITER] = [AIRDROP_APPROACH, LANDING]
// Once you land the plane is still ARMED, or you could abort the landing and reenter somewhere
valid[LANDING] = [ARMED]
*/
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