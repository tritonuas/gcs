package interopconn

import (
	"testing"
)

var client *Client

// TestNewClientFailure tests invalid authentication values and makes sure
// the client isn't able to authenticate itself with the interop server
func TestNewClientFailure(t *testing.T) {
	var interopIP = "127.0.0.1"
	var interopPort = "8000"
	var badInteropUser = "Joe_Biden"
	var badInteropPass = "RidinWithBiden#46"
	var url = interopIP + ":" + interopPort

	_, intErr := NewClient(url, badInteropUser, badInteropPass)

	if !intErr.post {
		t.Error("Expected unsuccessful login, but login was successfull.")
	}
}

// TestNewClientSuccess tests valid authentication values and makes sure
// the client is able to authenticate itself with the interop server
func TestNewClientSuccess(t *testing.T) {
	var interopIP = "127.0.0.1"
	var interopPort = "8000"
	var interopUser = "testuser"
	var interopPass = "testpass"
	var url = interopIP + ":" + interopPort

	var intErr InteropError
	client, intErr = NewClient(url, interopUser, interopPass)

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

// TestPostTelemetry tests to make sure that posting correct telemtry can be
// uploaded to the server
func TestPostTelemetry(t *testing.T) {
	var lat float64 = 38
	var long float64 = -76
	var alt float64 = 100
	var head float64 = 90
	telem := Telemetry{
		Latitude:  &lat,
		Longitude: &long,
		Altitude:  &alt,
		Heading:   &head,
	}

	intErr := client.PostTelemetry(&telem)

	if intErr.post {
		t.Error("Expected post error to be false, but it was true")
	}
}

// TestPostBadTelemetry tests to make sure that posting invalid telemetry will
// error as we expect it to
func TestPostBadTelemetry(t *testing.T) {
	var lat float64 = 38
	var long float64 = -76
	var alt float64 = 100
	var head float64 = 400 // this is out of range
	telem := Telemetry{
		Latitude:  &lat,
		Longitude: &long,
		Altitude:  &alt,
		Heading:   &head,
	}

	intErr := client.PostTelemetry(&telem)

	if !intErr.post {
		t.Error("Expected post error to be true, but it was false")
	}
}

// TestODLCs tests the whole workflow dealing with ODLCs
func TestODLCs(t *testing.T) {
	// Testing psot
}

// TODO: rest of unit tests for client functionality
