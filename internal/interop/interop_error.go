package interop

import "strings"

type InteropError struct {
	Get     bool   // Signifies error from a get request
	Post    bool   // Signifies error from a post request
	Put     bool   // Signifies error from a put request
	Delete  bool   // Signifies error from a delete request
	Message []byte // Holds the error message
	Status  int    // Holds the HTTP status code
}

// NewInteropError creates an InteropError object with all error flags set to
// false.
func NewInteropError() *InteropError {
	err := &InteropError{
		Get:     false,
		Post:    false,
		Put:     false,
		Delete:  false,
		Message: nil,
		Status:  200,
	}

	return err
}

// SetError sets the attributes of the interop error accordingly to the parameters
// passed through
func (i *InteropError) SetError(errType string, message []byte, status int) {
	errType = strings.ToUpper(errType)
	switch errType {
	case "GET":
		i.Get = true
	case "POST":
		i.Post = true
	case "PUT":
		i.Put = true
	case "DELETE":
		i.Delete = true
	}
	i.Message = message
	i.Status = status
}
