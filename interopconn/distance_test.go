package interopconn

import "testing"

func TestGPSDistance(t *testing.T) {
	total := gpsDistanceRaw(127.123, 192.343, 127.123, 192.343)
	if total != 0 {
		t.Errorf("Gps distance incorrect, got: %g, want: %g.", total, 0.0)
	}
}

func TestWaypointDistance(t *testing.T) {
	total := waypointDistanceRaw(127.123, 192.343, 0, 127.123, 192.343, 0)
	if total != 0 {
		t.Errorf("Gps distance incorrect, got: %g, want: %g.", total, 0.0)
	}
}
