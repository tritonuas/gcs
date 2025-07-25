// Package utils contains helper types (such as HTTPError) that are reused
// across multiple server/client components.
//nolint:revive // package name 'utils' is acceptable here
package utils

import "strings"

// HTTPError stores what kind of HTTP method had an error,
// a message, and the status code from the response
type HTTPError struct {
	Get     bool   // Signifies error from a get request
	Post    bool   // Signifies error from a post request
	Put     bool   // Signifies error from a put request
	Delete  bool   // Signifies error from a delete request
	Message []byte // Holds the error message
	Status  int    // Holds the HTTP status code
}

// NewHTTPError creates a new HTTPError instance with all flags cleared and a
// default 200 OK status.
func NewHTTPError() *HTTPError {
	err := &HTTPError{
		Get:     false,
		Post:    false,
		Put:     false,
		Delete:  false,
		Message: nil,
		Status:  200,
	}

	return err
}

// SetError sets the attributes of the RTPP error accordingly to the parameters
// passed through
func (i *HTTPError) SetError(errType string, message []byte, status int) {
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
