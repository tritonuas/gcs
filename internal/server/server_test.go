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

	/*
	TODO: we should probably check that the timer keeps track of time properly (if you make a get request at 5 seconds it returns "5s").
	I tried doing this using the time library, but it was hard to send a GET request exactly 5 seconds after starting the timer with a POST request due to the latency in each line of code.
	Another idea for this would be to make sure the time is accurate within a certain margin of error to account for said latency.
	*/
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

	req, _ := http.NewRequest("POST", "/plane/airdrop", bytes.NewReader(jsonData))

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles, server.Bottles)
}

/*
Tests that posting a new drop order multiple times consecutively overwrites all old values
*/
func TestUploadDropOrderMultipleTimes(t *testing.T) {
	expectedBottles1stPost := []server.Bottle{
		{"C", "brown", "square", "purple", 0, false},
		{"X", "turquoise", "parallelogram", "lavender", 1, false},
		{"A", "white", "triangle", "blue", 2, false},
		{"B", "black", "circle", "red", 3, false},
		{"", "", "", "", 4, true},
	}

	expectedBottles2ndPost := []server.Bottle{
		{"B", "black", "circle", "red", 3, false},
		{"C", "brown", "square", "purple", 0, false},
		{"L", "white", "triangle", "blue", 2, false},
		{"", "", "", "", 4, true},
		{"X", "turquoise", "parallelogram", "lavender", 1, false},
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


    var jsonData2 = []byte(`[
								{
									"alphanumeric": "B",
									"alphanumeric_color": "black",
									"shape": "circle",
									"shape_color": "red",
									"drop_index": 3,
									"is_mannikin": false
								},
								{
									"alphanumeric": "C",
									"alphanumeric_color": "brown",
									"shape": "square",
									"shape_color": "purple",
									"drop_index": 0,
									"is_mannikin": false
								},
								{
									"alphanumeric": "L",
									"alphanumeric_color": "white",
									"shape": "triangle",
									"shape_color": "blue",
									"drop_index": 2,
									"is_mannikin": false
								},
								{
									"alphanumeric": "",
									"alphanumeric_color": "",
									"shape": "",
									"shape_color": "",
									"drop_index": 4,
									"is_mannikin": true
								},
								{
									"alphanumeric": "X",
									"alphanumeric_color": "turquoise",
									"shape": "parallelogram",
									"shape_color": "lavender",
									"drop_index": 1,
									"is_mannikin": false
								}
							]`)

	req, _ := http.NewRequest("POST", "/plane/airdrop", bytes.NewReader(jsonData))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles1stPost, server.Bottles)

    w = httptest.NewRecorder()

	req, _ = http.NewRequest("POST", "/plane/airdrop",bytes.NewReader(jsonData2))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles2ndPost, server.Bottles)
}

/*
Tests that the drop order is returned properly after posting 5 valid bottles
*/
func TestGetDropOrderValidCheck(t *testing.T) {
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
	
	// need to remove all the newlines, spaces, and tabs from the json body above; not sure why this isn't done automatically (I love golang! I love golang!)
	jsonData = bytes.ReplaceAll(jsonData, []byte("\n"), []byte(""))
	jsonData = bytes.ReplaceAll(jsonData, []byte("\t"), []byte(""))
	jsonData = bytes.ReplaceAll(jsonData, []byte(" "), []byte(""))

	req, _ := http.NewRequest("POST", "/plane/airdrop", bytes.NewReader(jsonData))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()

	req, _ = http.NewRequest("GET", "/plane/airdrop", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, jsonData, w.Body.Bytes())
}

/*
Tests that querying the bottle drop ordering before someone has posted one returns an error
*/
func TestGetDropOrderBeforeBottlesUploaded(t *testing.T) {
	server := server.Server{}

	router := server.SetupRouter()

	w := httptest.NewRecorder()

	req, _ := http.NewRequest("GET", "/plane/airdrop", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

/*
Tests that using updateDropOrder() updates the values of a single bottle given the proper id
*/
func TestUpdateDropOrderValidCheck(t *testing.T) {
	expectedBottles := []server.Bottle{
		{"C", "brown", "square", "purple", 0, false},
		{"X", "turquoise", "parallelogram", "lavender", 1, false},
		{"4", "gray", "triangle", "purple", 2, false},
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

	req, _ := http.NewRequest("POST", "/plane/airdrop", bytes.NewReader(jsonData))

	router.ServeHTTP(w, req)

	// quick check to make sure post request was successful
	assert.Equal(t, http.StatusOK, w.Code)

	var singleBottleJsonData = []byte(`{
											"alphanumeric": "4",
											"alphanumeric_color": "gray",
											"shape": "triangle",
											"shape_color": "purple",
											"drop_index": 2,
											"is_mannikin": false
										}`)

	w = httptest.NewRecorder()

	req, _ = http.NewRequest("PATCH", "/plane/airdrop", bytes.NewReader(singleBottleJsonData))

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles, server.Bottles)
}