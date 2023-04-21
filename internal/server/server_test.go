package server_test

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/tritonuas/gcs/internal/obc/airdrop"
	"github.com/tritonuas/gcs/internal/obc/pp"
	"github.com/tritonuas/gcs/internal/server"
)

func TestPostOBCTargets(t *testing.T) {
	// TODO: include more values to check (currently only checks for http status code and number of targets uploaded)
	// TODO: Test more accurate JSON values passed through once we get real values
	testCases := []struct {
		name           string
		inputJSON      io.Reader
		wantCode       int
		wantNumTargets int
	}{
		{
			name:           "nil json",
			inputJSON:      nil,
			wantCode:       http.StatusBadRequest,
			wantNumTargets: 0,
		},
		{
			name:           "valid json (only timestamp)",
			inputJSON:      strings.NewReader("[{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"),
			wantCode:       http.StatusOK,
			wantNumTargets: 1,
		},
		{
			name:           "valid json (only plane_lat)",
			inputJSON:      strings.NewReader("[{\"plane_lat\": 32.45}]"),
			wantCode:       http.StatusOK,
			wantNumTargets: 1,
		},
	}

	for _, tc := range testCases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}

			router := server.SetupRouter()

			w := httptest.NewRecorder()
			req, err := http.NewRequest("POST", "/api/targets/unclassified", tc.inputJSON)
			assert.Nil(t, err)

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

	req, err := http.NewRequest("POST", "/api/mission/time", nil)
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

/*
Tests that the mission timer starts and keeps track of the elapsed time accordingly when requested after the timer has been started.
TODO: maybe add expected http return code to struct
*/
func TestGetTimeElapsed(t *testing.T) {
	testCases := []struct {
		name     string
		waitTime float64
	}{
		// querying the mission timer before it has been initialized should return an error
		{
			name:     "before timer start",
			waitTime: 0.0,
		},
		{
			name:     "no wait",
			waitTime: 0.0,
		},
		{
			name:     "3 seconds",
			waitTime: 3.0,
		},
		{
			name:     "6 seconds",
			waitTime: 6.0,
		},
	}

	for _, tc := range testCases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}
			router := server.SetupRouter()

			w := httptest.NewRecorder()

			var req *http.Request
			var err error

			if tc.name == "before timer start" {
				req, err = http.NewRequest("GET", "/api/mission/time", nil)
				assert.Nil(t, err)

				router.ServeHTTP(w, req)
				assert.Equal(t, http.StatusBadRequest, w.Code)
			} else {
				req, err = http.NewRequest("POST", "/api/mission/time", nil)
				assert.Nil(t, err)
				router.ServeHTTP(w, req)
				timer := time.Now()
				time.Sleep(time.Duration(tc.waitTime) * time.Second)

				w = httptest.NewRecorder()
				req, err = http.NewRequest("GET", "/api/mission/time", nil)
				assert.Nil(t, err)
				router.ServeHTTP(w, req)

				assert.Equal(t, http.StatusOK, w.Code)

				// will come out as "4.21423" or "0.00012"
				unixTime, strerr := strconv.ParseInt(w.Body.String(), 10, 64)
				fmt.Println(unixTime)
				assert.Nil(t, strerr)
				assert.LessOrEqual(t, unixTime, timer.Unix())
				t.Logf("Expected: %d\n", timer.Unix())
				t.Logf("Actual: %d\n", unixTime)
			}
		})
	}
}

/*
Tests that posting the drop order with 5 valid targets successfully updates the Bottles element in the server struct
*/
func TestUploadDropOrder5ValidTargets(t *testing.T) {
	expectedBottles := []airdrop.Bottle{
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

	req, err := http.NewRequest("POST", "/api/plane/airdrop", bytes.NewReader(jsonData))
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles, server.Bottles.Bottles)
}

/*
Tests that posting a new drop order multiple times consecutively overwrites all old values
*/
func TestUploadDropOrderMultipleTimes(t *testing.T) {
	expectedBottles1stPost := []airdrop.Bottle{
		{"C", "brown", "square", "purple", 0, false},
		{"X", "turquoise", "parallelogram", "lavender", 1, false},
		{"A", "white", "triangle", "blue", 2, false},
		{"B", "black", "circle", "red", 3, false},
		{"", "", "", "", 4, true},
	}

	expectedBottles2ndPost := []airdrop.Bottle{
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

	req, err := http.NewRequest("POST", "/api/plane/airdrop", bytes.NewReader(jsonData))
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles1stPost, server.Bottles.Bottles)

	w = httptest.NewRecorder()

	req, err = http.NewRequest("POST", "/api/plane/airdrop", bytes.NewReader(jsonData2))
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles2ndPost, server.Bottles.Bottles)
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

	req, err := http.NewRequest("POST", "/api/plane/airdrop", bytes.NewReader(jsonData))
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()

	req, err = http.NewRequest("GET", "/api/plane/airdrop", nil)
	assert.Nil(t, err)

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

	req, err := http.NewRequest("GET", "/api/plane/airdrop", nil)
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

/*
Tests that using updateDropOrder() updates the values of a single bottle given the proper id
*/
func TestUpdateDropOrderValidCheck(t *testing.T) {
	expectedBottles := []airdrop.Bottle{
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

	req, err := http.NewRequest("POST", "/api/plane/airdrop", bytes.NewReader(jsonData))
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	// quick check to make sure post request was successful
	assert.Equal(t, http.StatusOK, w.Code)

	var singleBottleJSONData = []byte(`{
											"alphanumeric": "4",
											"alphanumeric_color": "gray",
											"shape": "triangle",
											"shape_color": "purple",
											"drop_index": 2,
											"is_mannikin": false
										}`)

	w = httptest.NewRecorder()

	req, err = http.NewRequest("PATCH", "/api/plane/airdrop", bytes.NewReader(singleBottleJSONData))
	assert.Nil(t, err)

	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	assert.Equal(t, expectedBottles, server.Bottles.Bottles)
}
func TestUploadFlightBounds(t *testing.T) {
	testCases := []struct {
		name       string
		inputJSON  io.Reader
		wantCode   int
		wantBounds []pp.Coordinate
	}{
		{
			name:       "nil json",
			inputJSON:  nil,
			wantCode:   http.StatusBadRequest,
			wantBounds: nil,
		},
		/* Coordinate values were 0 expected null */
		// {
		// 	name:       "invalid json",
		// 	inputJSON:  strings.NewReader("[{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"),
		// 	wantCode:   http.StatusBadRequest,
		// 	wantBounds: nil,
		// },
		// {
		// 	name:       "invalid json 2",
		// 	inputJSON:  strings.NewReader("[{\"plane_lat\": 32.45}, {\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"),
		// 	wantCode:   http.StatusBadRequest,
		// 	wantBounds: nil,
		// },
		{
			name:       "2 valid coordinates",
			inputJSON:  strings.NewReader("[{\"latitude\": 30, \"longitude\": 32}, {\"latitude\": 31, \"longitude\": 20}]"),
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{{30, 32}, {31, 20}},
		},
		{
			name:       "empty coords",
			inputJSON:  strings.NewReader("[]"),
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{},
		},
	}

	for _, tc := range testCases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}

			router := server.SetupRouter()

			w := httptest.NewRecorder()
			req, err := http.NewRequest("POST", "/api/mission/bounds/flight", tc.inputJSON)
			assert.Nil(t, err)

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.wantCode, w.Code)
			assert.Equal(t, tc.wantBounds, server.Mission.FlightBoundaries)
		})
	}
}

func TestUploadSearchBounds(t *testing.T) {
	testCases := []struct {
		name       string
		inputJSON  io.Reader
		wantCode   int
		wantBounds []pp.Coordinate
	}{
		{
			name:       "nil json",
			inputJSON:  nil,
			wantCode:   http.StatusBadRequest,
			wantBounds: nil,
		},
		/* Coordinate values were 0 expected null */
		// {
		// 	name:       "invalid json",
		// 	inputJSON:  strings.NewReader("[{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"),
		// 	wantCode:   http.StatusBadRequest,
		// 	wantBounds: nil,
		// },
		// {
		// 	name:       "invalid json 2",
		// 	inputJSON:  strings.NewReader("[{\"plane_lat\": 32.45}, {\"timestamp\": \"2022-10-28T00:43:44.698Z\"}]"),
		// 	wantCode:   http.StatusBadRequest,
		// 	wantBounds: nil,
		// },
		{
			name:       "2 valid coordinates",
			inputJSON:  strings.NewReader("[{\"latitude\": 30, \"longitude\": 32}, {\"latitude\": 31, \"longitude\": 20}]"),
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{{30, 32}, {31, 20}},
		},
		{
			name:       "empty coords",
			inputJSON:  strings.NewReader("[]"),
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{},
		},
	}

	for _, tc := range testCases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}

			router := server.SetupRouter()

			w := httptest.NewRecorder()
			req, err := http.NewRequest("POST", "/api/mission/bounds/search", tc.inputJSON)
			assert.Nil(t, err)

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.wantCode, w.Code)
			assert.Equal(t, tc.wantBounds, server.Mission.SearchBoundaries)
		})
	}
}

func TestGetFlightBounds(t *testing.T) {
	testCases := []struct {
		name       string
		wantCode   int
		wantBounds []pp.Coordinate
	}{
		{
			name:       "nil json",
			wantCode:   http.StatusBadRequest,
			wantBounds: nil,
		},
		{
			name:       "2 valid coordinates",
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{{30, 32}, {31, 20}},
		},
		{
			name:       "empty coords",
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{},
		},
	}

	for _, tc := range testCases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}
			server.Mission.FlightBoundaries = tc.wantBounds
			router := server.SetupRouter()

			w := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/api/mission/bounds/field", nil)
			assert.Nil(t, err)

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.wantCode, w.Code)
			assert.Equal(t, tc.wantBounds, server.Mission.FlightBoundaries)
		})
	}
}

func TestGetSearchBounds(t *testing.T) {
	testCases := []struct {
		name       string
		wantCode   int
		wantBounds []pp.Coordinate
	}{
		{
			name:       "nil json",
			wantCode:   http.StatusBadRequest,
			wantBounds: nil,
		},
		{
			name:       "2 valid coordinates",
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{{30, 32}, {31, 20}},
		},
		{
			name:       "empty coords",
			wantCode:   http.StatusOK,
			wantBounds: []pp.Coordinate{},
		},
	}

	for _, tc := range testCases {
		// this line is needed to avoid a race condition when running tests in parallel.
		// more info here: https://gist.github.com/posener/92a55c4cd441fc5e5e85f27bca008721
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			server := server.Server{}
			server.Mission.SearchBoundaries = tc.wantBounds
			router := server.SetupRouter()

			w := httptest.NewRecorder()
			req, err := http.NewRequest("GET", "/api/mission/bounds/airdrop", nil)
			assert.Nil(t, err)

			router.ServeHTTP(w, req)

			assert.Equal(t, tc.wantCode, w.Code)
			assert.Equal(t, tc.wantBounds, server.Mission.SearchBoundaries)
		})
	}
}
