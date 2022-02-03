package interop

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"testing"
)

// Need to relook at this file!

var client *Client

// TestNewClientFailure tests invalid authentication values and makes sure
// the client isn't able to authenticate itself with the interop server
func TestNewClientFailure(t *testing.T) {
	_, intErr := NewClient("127.0.0.1:8000", "Joe_Biden", "RidinWithBiden#46", 10)

	if !intErr.Post {
		t.Error("Expected unsuccessful login, but login was successfull.")
	}
}

// TestNewClientSuccess tests valid authentication values and makes sure
// the client is able to authenticate itself with the interop server
func TestNewClientSuccess(t *testing.T) {
	var intErr InteropError
	client, intErr = NewClient("127.0.0.1:8000", "testuser", "testpass", 10)

	if intErr.Post {
		t.Error("Expected successful login, but login was unsuccessful.")
	}
}

// TODO: add method to test timout functionality once that is added to the
// client struct

// TestGetTeams tests to make sure the array of team statuses from the server
// are correctly set
func TestGetTeams(t *testing.T) {
	teams, intErr := client.GetTeams()

	var teamList []TeamStatus
	json.Unmarshal(teams, &teamList)

	if len(teamList) != 1 {
		t.Errorf("Expected length of teams array to be 1, was %d", len(teamList))
	}
	if intErr.Get {
		t.Error("Get Error")
	}
}

// TestGetMission tests to make sure that the mission gotten from the server
// is correctly set
func TestGetMission(t *testing.T) {
	missionData, intErr := client.GetMission(1)

	var mission Mission
	json.Unmarshal(missionData, &mission)

	if mission.GetId() != 1 {
		t.Errorf("Expected id of mission to be 1, was %d", mission.GetId())
	}
	if intErr.Get {
		t.Error("Get Error")
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

	telemJSON, _ := json.Marshal(telem)

	err := client.PostTelemetry(telemJSON)

	if err.Post {
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

	telemJSON, _ := json.Marshal(telem)

	err := client.PostTelemetry(telemJSON)

	if !err.Post {
		t.Error("Expected post error to be true, but it was false")
	}
}

// TestODLCs tests the whole workflow dealing with ODLCs
func TestODLCs(t *testing.T) {
	// Test posting an odlc
	odlcMission := int32(1)
	odlcType := Odlc_STANDARD
	postODLC := &Odlc{
		Mission: &odlcMission,
		Type:    &odlcType,
	}

	postOdlcJSON, _ := json.Marshal(postODLC)

	postOdlcJSON, intErr := client.PostODLC(postOdlcJSON)
	if intErr.Post {
		t.Error("Expected PostODLC post error to be false, but it was true")
	}
	// sorry
	json.Unmarshal(postOdlcJSON, &postODLC)
	if postODLC.GetId() == 0 {
		t.Error("Expected to have an updated odlc ID, but it was still 0")
	}

	// Test getting an odlc
	getOdlcJSON, intErr := client.GetODLC(postODLC.GetId())
	if intErr.Get {
		t.Error("Expected GetODLC get error to be false, but it was true")
	}

	var getODLC *Odlc
	json.Unmarshal(getOdlcJSON, &getODLC)

	if !compareODLCs(getODLC, postODLC) {
		t.Error("Expected getODLC and postODLC to be equal, but they were not")
	}

	getODLCsJSON, intErr := client.GetODLCs(-1)
	if intErr.Get {
		t.Error("Expected GetODLCs get error to be false, but it was true")
	}

	var getODLCs []Odlc
	json.Unmarshal(getODLCsJSON, &getODLCs)

	// check if the posted odlc is in the list of odlcs
	containsPostODLC := false
	for _, tempODLC := range getODLCs {
		if compareODLCs(&tempODLC, postODLC) {
			containsPostODLC = true
			break
		}
	}
	if !containsPostODLC {
		t.Error("Expected getODLCs to contain postODLC, but it did not")
	}

	getODLCsMissionJSON, intErr := client.GetODLCs(1)
	if intErr.Get {
		t.Error("Expected GetODLCsMission get error to be false, but it was true")
	}

	var getODLCsMission []Odlc
	json.Unmarshal(getODLCsMissionJSON, &getODLCsMission)

	// check if the posted odlc is also in this list of odlcs
	containsPostODLC = false
	for _, tempODLC := range getODLCsMission {
		if compareODLCs(&tempODLC, postODLC) {
			containsPostODLC = true
			break
		}
	}
	if !containsPostODLC {
		t.Error("Expected getODLCsMission to contain postODLC, but it did not")
	}

	getODLCsBadMissionJSON, intErr := client.GetODLCs(2)
	if intErr.Get {
		t.Error("Expected getODLCsBadMission get error to be false, but it was true")
	}

	var getODLCsBadMission []Odlc
	json.Unmarshal(getODLCsBadMissionJSON, &getODLCsBadMission)

	// check to make sure that the posted odlc is not also in this list of odlcs
	containsPostODLC = false
	for _, tempODLC := range getODLCsBadMission {
		if compareODLCs(&tempODLC, postODLC) {
			containsPostODLC = true
			break
		}
	}
	if containsPostODLC {
		t.Error("Expected getODLCsBadMission not to contain postODLC, but it did")
	}

	// Test updating an odlc
	putShape := Odlc_CIRCLE
	postODLC.Shape = &putShape
	intErr = client.PutODLC(postODLC.GetId(), postOdlcJSON)
	if intErr.Get {
		t.Error("Expected PutODLC get error to be false, but it was true")
	}

	// Test uploading an image

	// Making a test image using go's image libary
	width := 256
	height := 256
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.NRGBA{
				R: uint8((x + y) & 255),
				G: uint8((x + y) << 1 & 255),
				B: uint8((x + y) << 2 & 255),
				A: 255,
			})
		}
	}
	buff := new(bytes.Buffer)
	png.Encode(buff, img)
	b := []byte(fmt.Sprint(buff))
	// Actually put the image to the server
	intErr = client.PutODLCImage(postODLC.GetId(), b)
	if intErr.Put {
		t.Error("Expected PutODLCIMage put error to be false, but it was true")
	}

	// Test getting an image
	getImage, intErr := client.GetODLCImage(postODLC.GetId())
	if intErr.Get {
		t.Error("Expected GetODLCImage get error to be false, but it was true")
	}
	if !bytes.Equal(getImage, b) {
		t.Error("Expected getImage to be the same as the uploaded image, but it was not")
	}

	// Test deleting an image
	intErr = client.DeleteODLCImage(postODLC.GetId())
	if intErr.Delete {
		t.Error("Expected DeleteODLCImage delete error to be false, but it was true")
	}

	// Test deleting an odlc
	intErr = client.DeleteODLC(postODLC.GetId())
	if intErr.Delete {
		t.Error("Expected DeleteODLC delete error to be false, but it was true")
	}

	newODLCsListJSON, intErr := client.GetODLCs(-1)

	var newODLCsList []Odlc
	json.Unmarshal(newODLCsListJSON, &newODLCsList)

	containsDeletedODLC := false
	for _, tempODLC := range newODLCsList {
		if compareODLCs(&tempODLC, postODLC) {
			containsDeletedODLC = true
			break
		}
	}
	if containsDeletedODLC {
		t.Error("Expected newODLCsList to not contain the deleted ODLC, but it did")
	}
}

func compareODLCs(odlc1, odlc2 *Odlc) bool {
	// Have to manually define all of the comparisons because the
	// protoImpl.MessageState won't let us just use == to compare 2 Odlc objects
	// directly since the message state cant be compared
	return odlc1.GetId() == odlc2.GetId() &&
		odlc1.GetMission() == odlc2.GetMission() &&
		odlc1.GetType() == odlc2.GetType() &&
		odlc1.GetLatitude() == odlc2.GetLatitude() &&
		odlc1.GetLongitude() == odlc2.GetLongitude() &&
		odlc1.GetOrientation() == odlc2.GetOrientation() &&
		odlc1.GetShape() == odlc2.GetShape() &&
		odlc1.GetAlphanumeric() == odlc2.GetAlphanumeric() &&
		odlc1.GetShapeColor() == odlc2.GetShapeColor() &&
		odlc1.GetAlphanumericColor() == odlc2.GetAlphanumericColor() &&
		odlc1.GetDescription() == odlc2.GetDescription() &&
		odlc1.GetAutonomous() == odlc2.GetAutonomous()

}

// TODO: rest of unit tests for client functionality
