package pp

import (
	"reflect"
	"testing"
)

func TestPath_GetPath(t *testing.T) {
	type fields struct {
		Waypoints         []Waypoint
		PlaneAcknowledged bool
	}
	tests := []struct {
		name   string
		fields fields
		want   []Waypoint
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := Path{
				Waypoints:         tt.fields.Waypoints,
				PlaneAcknowledged: tt.fields.PlaneAcknowledged,
			}
			if got := p.GetPath(); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Path.GetPath() = %v, want %v", got, tt.want)
			}
		})
	}
}
