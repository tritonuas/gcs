package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"strings"

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