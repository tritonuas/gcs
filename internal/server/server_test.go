package server_test

import (
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

	req, _ := http.NewRequest("POST", "/obc/targets", strings.NewReader("{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}"))
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, 1, len(server.UnclassifiedTargets))
	assert.Equal(t, "2022-10-28T00:43:44.698Z", server.UnclassifiedTargets[0].Timestamp)

	// test again
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("POST", "/obc/targets", strings.NewReader("{\"plane_lat\": 32.45}"))
	router.ServeHTTP(w2, req2)

	assert.Equal(t, http.StatusOK, w2.Code)

	assert.Equal(t, 2, len(server.UnclassifiedTargets))
	assert.Equal(t, 32.45, server.UnclassifiedTargets[1].PlaneLat)
}

func TestInflux(t *testing.T) {
	server := server.Server{}
	router := server.SetupRouter()
	w1 := httptest.NewRecorder()
	w2 := httptest.NewRecorder()
	w3 := httptest.NewRecorder()
	w4 := httptest.NewRecorder()

	// Request before data
	req1, _ := http.NewRequest("GET", "/telemetry/latest", strings.NewReader(""))
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusNoContent, w1.Code, "Get latest telemetry when empty should return NoContent(204).")

	// Bad Post
	req2, _ := http.NewRequest("POST", "/telemetry/latest", strings.NewReader("Hello! I'm not JSON data!"))
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusBadRequest, w2.Code, "POST non-JSON or malformed JSON should return BadRequest(400).")

	// Good Post
	req3, _ := http.NewRequest("POST", "/telemetry/latest", strings.NewReader("{\"latitude\":1,\"longitude\":2,\"altitude\":3,\"heading\":4}"))
	router.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusNoContent, w3.Code, "POST telemetry JSON should return NoContent(204).")

	// Get the data
	req4, _ := http.NewRequest("GET", "/telemetry/latest", strings.NewReader(""))
	router.ServeHTTP(w4, req4)
	assert.Equal(t, http.StatusOK, w4.Code, "GET latest telemetry should return HTTP-OK(200).")
	// assert.Equal(t, "{}", w.Body.String())
}
