package manager

type Manager struct {
	state   State         // Current state of the mission
	history []StateChange // History of all state changes in the mission
	manual  bool          // Flag if we are in manual flight or not
}

func (m Manager) New() *Manager {
	return &Manager{DORMANT, [], false}	
}