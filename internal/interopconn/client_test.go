package interopconn

import (
	"testing"
)

var client *Client

// TestNewClientFailure tests invalid authentication values and makes sure
// the client isn't able to authenticate itself with the interop server
func TestNewClientFailure(t *testing.T) {
	var interop_ip = "127.0.0.1"
	var interop_port = "8000"
	var bad_interop_user = "Joe_Biden"
	var bad_interop_pass = "RidinWithBiden#46"
	var url = interop_ip + ":" + interop_port

	_, intErr := NewClient(url, bad_interop_user, bad_interop_pass)

	if !intErr.post {
		t.Error("Expected unsuccessful login, but login was successfull.")
	}
}

// TestNewClientSuccess tests valid authentication values and makes sure
// the client is able to authenticate itself with the interop server
func TestNewClientSuccess(t *testing.T) {
	var interop_ip = "127.0.0.1"
	var interop_port = "8000"
	var interop_user = "testuser"
	var interop_pass = "testpass"
	var url = interop_ip + ":" + interop_port

	var intErr InteropError
	client, intErr = NewClient(url, interop_user, interop_pass)

	if intErr.post {
		t.Error("Expected successful login, but login was unsuccessful.")
	}
}

// TODO: add method to test timout functionality once that is added to the
// client struct

// TestGetTeams tests to make sure the array of team statuses from the server
// are correctly set
func TestGetTeams(t *testing.T) {
	teams, intErr := client.GetTeams()

	if len(teams) != 1 {
		t.Errorf("Expected length of teams array to be 1, was %d", len(teams))
	}
	if intErr.output {
		t.Error("Output Error")
	}
}

// TestGetMission tests to make sure that the mission gotten from the server
// is correctly set
func TestGetMission(t *testing.T) {
	mission, intErr := client.GetMission(1)

	if mission.GetId() != 1 {
		t.Errorf("Expected id of mission to be 1, was %d", mission.GetId())
	}
	if intErr.output {
		t.Error("Output Error")
	}
}

// TODO: rest of unit tests for client functionality
