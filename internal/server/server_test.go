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

func TestInflux(t *testing.T) {
	server := server.Server{}
	router := server.SetupRouter()

	// Request before data
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("GET", "/telemetry/latest", strings.NewReader(""))
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusNoContent, w1.Code, "Get latest telemetry when empty should return NoContent(204).")

	// Bad Post
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/telemetry/latest", strings.NewReader("Hello! I'm not JSON data!"))
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code, "POST non-JSON or malformed JSON should return BadRequest(400).")

	// Good Post
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest("POST", "/telemetry/latest", strings.NewReader("{\"longitude\":2,\"altitude\":3,\"heading\":4,\"latitude\":1}"))
	router.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusNoContent, w3.Code, "POST telemetry JSON should return NoContent(204).")

	// Get the data
	w4 := httptest.NewRecorder()
	req4, _ := http.NewRequest("GET", "/telemetry/latest", strings.NewReader(""))
	router.ServeHTTP(w4, req4)
	assert.Equal(t, http.StatusOK, w4.Code, "GET latest telemetry should return HTTP-OK(200).")
	// assert.Equal(t, "{}", w.Body.String())

	// Look at all of telemetry history
	w5 := httptest.NewRecorder()
	req5, _ := http.NewRequest("GET", "/telemetry/history", strings.NewReader(""))
	router.ServeHTTP(w5, req5)
	assert.Equal(t, http.StatusOK, w5.Code, "Request history expects HTTP-OK(200).")
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
