package interop

type InteropError struct {
	Get    bool // Signifies error from a get request
	Post   bool // Signifies error from a post request
	Put    bool // Signifies error from a put request
	Delete bool // Signifies error from a delete request
}

// NewInteropError creates an InteropError object with all error flags set to
// false.
func NewInteropError() *InteropError {
	err := &InteropError{
		Get:    false,
		Post:   false,
		Put:    false,
		Delete: false,
	}

	return err
}
