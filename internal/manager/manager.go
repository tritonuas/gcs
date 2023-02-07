package manager

type Manager struct {
	State   State         // Current state of the mission
	History []StateChange // History of all state changes in the mission
	Manual  bool          // Flag if we are in manual flight or not
}

func NewManager() *Manager {
	return &Manager{DORMANT, [], false}	
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
func (m Manager) ChangeState(new State) bool {
	change = NewStateChange(m.State, new)
	
	if change == nil {
		return false
	}

	m.history = append(m.history, change)
	m.State = new
	return true
}

/*
	Returns time that we have spent in the current state in seconds
	Returns -1 if we have never made a state change (never left DORMANT)
*/
func (m Manager) GetTimeInCurrentState() int {
	if len(m.history) == 0 {
		return -1
	}

	return time.Now().sub(m.history[-1])
}