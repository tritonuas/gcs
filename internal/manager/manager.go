package manager

import (
	"fmt"
)

type Manager struct {
	State   State         // Current state of the mission
	History []StateChange // History of all state changes in the mission
	Manual  bool          // Flag if we are in manual flight or not
}

func NewManager() *Manager {
	return &Manager{DORMANT, []StateChange{}, false}	
}

func (m Manager) HistoryJSON() []map[string]string {
	json := []map[string]string{}
	
	for _, change := range m.History {
		map := map[string]string {
			"Prev": change.prev.String(),
			"New": change.prev.String(),
			"Time": fmt.Sprintf("%d", change.time.Unix()),
		}
		json = append(json, map)
	}

	return json
}

/*
	This should be run in the background in its own goroutine. It is the main logic of
	the mission manager that tracks all of the states.
*/
func (m Manager) Start() {
	for {
		switch m.State {
		case DORMANT:
		case UNARMED:
		case ARMED:
		case TAKEOFF:
		case WAYPOINT:
		case SEARCH:
		case CV_LOITER:
		case AIRDROP_APPROACH:
		case AIRDROP_LOITER:
		case LANDING:
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

func (m Manager) GetCurrentStateStartTime() int64 {
	if len(m.History) == 0 {
		return -1
	}

	return m.History[len(m.History)-1].time.Unix()
}