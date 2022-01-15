package path_plan

import "strings"

type RTPPError struct {
	Get     bool   // Signifies error from a get request
	Post    bool   // Signifies error from a post request
	Put     bool   // Signifies error from a put request
	Delete  bool   // Signifies error from a delete request
	Message []byte // Holds the error message
	Status  int    // Holds the HTTP status code
}

// NewRTPPError creates an RTPPError object with all error flags set to
// false.
func NewRTPPError() *RTPPError {
	err := &RTPPError{
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
func (i *RTPPError) SetError(errType string, message []byte, status int) {
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
