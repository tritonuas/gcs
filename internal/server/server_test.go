package server_test

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tritonuas/hub/internal/server"
)

func TestPostOBCTargets(t *testing.T) {
	// TODO: include more values to check (currently only checks for http status code and number of targets uploaded)
	// TODO: Test more accurate JSON values passed through once we get real values
	test_cases := []struct {
		name           string
		inputJson      io.Reader
		wantCode       int
		wantNumTargets int
	}{
		{
			name:           "nil json",
			inputJson:      nil,
			wantCode:       http.StatusBadRequest,
			wantNumTargets: 0,
		},
		{
			name:           "valid json (only timestamp)",
			inputJson:      strings.NewReader("[{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"),
			wantCode:       http.StatusOK,
			wantNumTargets: 1,
		},
		{
			name:           "valid json (only plane_lat)",
			inputJson:      strings.NewReader("[{\"plane_lat\": 32.45}]"),
			wantCode:       http.StatusOK,
			wantNumTargets: 1,
		},
	}

	for _, tc := range test_cases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}

			router := server.SetupRouter()

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/obc/targets", tc.inputJson)
			router.ServeHTTP(w, req)

			assert.Equal(t, tc.wantCode, w.Code)
			assert.Equal(t, tc.wantNumTargets, len(server.UnclassifiedTargets))
		})
	}
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
