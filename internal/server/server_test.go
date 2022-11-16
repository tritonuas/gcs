package server_test

import (
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
			inputJson:      strings.NewReader("{\"timestamp\": \"2022-10-28T00:43:44.698Z\"}"),
			wantCode:       http.StatusOK,
			wantNumTargets: 1,
		},
		{
			name:           "valid json (only plane_lat)",
			inputJson:      strings.NewReader("{\"plane_lat\": 32.45}"),
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
