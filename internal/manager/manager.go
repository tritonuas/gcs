package manager

import (
	"fmt"
)

/*
Manager holds the state history of the plane and provides methods for managing the state of
the system
*/
type Manager struct {
	State   State         // Current state of the mission
	History []StateChange // History of all state changes in the mission
	Manual  bool          // Flag if we are in manual flight or not
}

/*
NewManager creates a pointer to a new manager with default values (DORMANT, Empty history, not in Manual control)
*/
func NewManager() *Manager {
	return &Manager{Dormant, []StateChange{}, false}
}

/*
HistoryJSON returns a json map of the StateChange history slice
*/
func (m Manager) HistoryJSON() []map[string]string {
	json := []map[string]string{}

	for _, change := range m.History {
		object := map[string]string{
			"Prev": change.Prev.String(),
			"New":  change.New.String(),
			"Time": fmt.Sprintf("%d", change.Time.Unix()),
		}
		json = append(json, object)
	}

	return json
}

/*
This should be run in the background in its own goroutine. It is the main logic of
the mission manager that tracks all of the states.
*/
func (m Manager) Start() {
	// TODO: add functionality as needed?
	for {
		switch m.State {
		case Dormant:
		case Unarmed:
		case Armed:
		case Takeoff:
		case Waypoint:
		case Search:
		case CVLoiter:
		case AirdropApproach:
		case AirdropLoiter:
		case Landing:
		}
	}
}

/*
Change State
Returns true if state change was successful (valid)
*/
func (m *Manager) ChangeState(new State) bool {
	change := NewStateChange(m.State, new)

	if change == nil {
		return false
	}

	m.History = append(m.History, *change)
	m.State = new
	return true
}

/*
GetCurrentStateStartTime gets the current state's start time in unix time.
*/
func (m Manager) GetCurrentStateStartTime() int64 {
	if len(m.History) == 0 {
		return -1
	}

	return m.History[len(m.History)-1].Time.Unix()
}
