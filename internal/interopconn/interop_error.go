package interopconn

type InteropError struct {
	get    bool // Signifies error from a get request
	post   bool // Signifies error from a post request
	put    bool // Signifies error from a put request
	delete bool // Signifies error from a delete request
	output bool // Signifies that the output of the func was invalid
}

// NewInteropError creates an InteropError object with all error flags set to
// false.
func NewInteropError() *InteropError {
	err := &InteropError{
		get:    false,
		post:   false,
		put:    false,
		delete: false,
		output: false,
	}

	return err
}
