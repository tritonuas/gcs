package interop

import (
	//"bytes"
	//"encoding/json"
	//"fmt"
	//"image"
	//"image/color"
	//"image/png"
	"testing"
)

// Need to relook at this file!


func TestNewClientFailureBadUser(t *testing.T) {
	badClient, err := NewClient("127.0.0.1:8000", "invalid_user", "invalid_pass", 10)
	// make sure this client is not correct and that the error is set like we'd expect

}

var client *Client

func TestNewClient(t *testing.T) {
	client, err := NewClient("127.0.0.1:8000", "testuser", "testpass", 10)
	// make sure this client is co and that the error is not set

}

// Now we can use this client object in further tests

func TestGetUsername(t *testing.T) {
	// call GetUsername on client
	// make sure this username is "testuser", error if not

	// to make this code better, perhaps define the username as a constant at the top of the file
}