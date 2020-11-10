package interopconn

type InteropError struct {
	get             bool
	post            bool
	put             bool
	delete          bool
	getTeams        bool
	getMission      bool
	postTelem       bool
	getODLCs        bool
	getODLC         bool
	postODLC        bool
	putODLC         bool
	deleteODLC      bool
	getODLCImage    bool
	postODLCImage   bool
	putODLCImage    bool
	deleteODLCImage bool
}
