package server_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tritonuas/hub/internal/server"
)

func TestPostOBCTargetsNilJSON(t *testing.T) {
	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/obc/targets", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

// TODO: Test more accurate JSON values passed through once we get real values

func TestPostOBCTargetsValidJSON(t *testing.T) {
	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()

	req, _ := http.NewRequest("POST", "/obc/targets", strings.NewReader("[{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 1, len(server.UnclassifiedTargets))
	assert.Equal(t, "2022-10-28T00:43:44.698Z", server.UnclassifiedTargets[0].Timestamp)

	// test again
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/obc/targets", strings.NewReader("[{\"plane_lat\": 32.45}]"))
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)

	assert.Equal(t, 2, len(server.UnclassifiedTargets))
	assert.Equal(t, 32.45, server.UnclassifiedTargets[1].PlaneLat)
}

/*
Tests that the mission timer starts as expected.
*/
func TestStartMissionTime(t *testing.T) {
	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()

	req, _ := http.NewRequest("POST", "/hub/time", nil)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

/*
Tests that the mission timer starts and keeps track of the elapsed time accordingly when requested after the timer has been started.
*/
func TestGetTimeElapsedValidCheck(t *testing.T) {
	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()

	req, _ := http.NewRequest("POST", "/hub/time", nil)
	router.ServeHTTP(w, req)

	w = httptest.NewRecorder()

	req, _ = http.NewRequest("GET", "/hub/time", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	//TODO: need to check that the timer works properly (if you make a get request at 5 seconds it returns "5s")
}

/*
Tests that querying the mission timer before it has been initialized returns an error.
*/
func TestGetTimeElapsedCheckBeforeTimerStarted(t *testing.T) {
	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()

	req, _ := http.NewRequest("GET", "/hub/time", nil)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

/*
Tests that posting the drop order with 5 valid targets successfully updates the Bottles element in the server struct
*/
func TestUploadDropOrder5ValidTargets(t *testing.T) {
	expectedBottles := []server.Bottle{
		{"C", "brown", "square", "purple", 0, false},
		{"X", "turquoise", "parallelogram", "lavender", 1, false},
		{"A", "white", "triangle", "blue", 2, false},
		{"B", "black", "circle", "red", 3, false},
		{"", "", "", "", 4, true},
	}

	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()

	var jsonData = []byte(`[
								{
									"alphanumeric": "C",
									"alphanumeric_color": "brown",
									"shape": "square",
									"shape_color": "purple",
									"drop_index": 0,
									"is_mannikin": false
								},
								{
									"alphanumeric": "X",
									"alphanumeric_color": "turquoise",
									"shape": "parallelogram",
									"shape_color": "lavender",
									"drop_index": 1,
									"is_mannikin": false
								},
								{
									"alphanumeric": "A",
									"alphanumeric_color": "white",
									"shape": "triangle",
									"shape_color": "blue",
									"drop_index": 2,
									"is_mannikin": false
								},
								{
									"alphanumeric": "B",
									"alphanumeric_color": "black",
									"shape": "circle",
									"shape_color": "red",
									"drop_index": 3,
									"is_mannikin": false
								},
								{
									"alphanumeric": "",
									"alphanumeric_color": "",
									"shape": "",
									"shape_color": "",
									"drop_index": 4,
									"is_mannikin": true
								}
							]`)

	req, _ := http.NewRequest("POST", "/plane/airdrop", bytes.NewBuffer(jsonData))

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, server.Bottles, expectedBottles)
}
