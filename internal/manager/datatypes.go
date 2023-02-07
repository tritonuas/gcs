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
	DORMANT State = iota // The plane is on the ground, but not armed
	ARMED                // The plane is on the ground and armed. Ready for takeoff

	// In Flight
	TAKEOFF              // The plane is taking off but hasn't started on waypoints yet
	WAYPOINT             // The plane is flying its initial waypoint path
	SEARCH               // The plane is either going towards the search zone or covering it
	CV_LOITER            // The plane is loitering outside the search zone waiting for all the results from CV
	AIRDROP_APPROACH     // The plane is approaching an airdrop point
	AIRDROP_LOITER       // The plane is loitering outside the search zone waiting for 15s buffer to pass
	LANDING              // The plane is approaching for a landing
)

/*
	String conversions so we can send current state around the network
*/
func (state State) String() string {
	switch (state) {
	case DORMANT:
		return "Dormant"
	case TAKEOFF:
		return "Takeoff"
	case WAYPOINT:
		return "Waypoint"
	case SEARCH:
		return "Search"
	case CV_LOITER:
		return "CV Loiter"
	case AIRDROP_APPROACH:
		return "Airdrop Approach"
	case AIRDROP_LOITER:
		return "Airdrop Loiter"
	case LANDING:
		return "Landing"
	}
}

/*
	This keeps track of state changes so we can have a history of the mission's progress
*/
type StateChange struct {
	prev State     // The previous state
	new  State     // The new state
	time time.Time // The time at which the change occurred
}