package main

import (
	"testing"

	pb "github.com/tritonuas/hub/interop"
)

func TestSetMission(t *testing.T) {
	mission := &pb.Mission{
		MissionWaypoints: make([]*pb.Waypoint, 5),
	}

	obstacles := &pb.Obstacles{
		MovingObstacles:     make([]*pb.MovingObstacle, 5),
		StationaryObstacles: make([]*pb.StationaryObstacle, 5),
	}

	missionReporting := MissionReportingBackend{}
	missionReporting.SetMission(mission, obstacles)

	status := missionReporting.missionReportStatus

	if len(status.MissionWaypoints) != len(mission.MissionWaypoints) {
		t.Errorf("Mission waypoint distance struct length incorrect: %d, want: %d.", len(status.MissionWaypoints), len(mission.MissionWaypoints))
	}

	if len(status.StationaryObstacles) != len(obstacles.StationaryObstacles) {
		t.Errorf("Mission waypoint distance struct length incorrect: %d, want: %d.", len(status.MissionWaypoints), len(mission.MissionWaypoints))
	}

	if len(status.MovingObstacles) != len(status.StationaryObstacles) {
		t.Errorf("Mission waypoint distance struct length incorrect: %d, want: %d.", len(status.MissionWaypoints), len(mission.MissionWaypoints))
	}

	if mission != missionReporting.mission {
		t.Errorf("Mission was not set correctly")
	}

	if obstacles != missionReporting.obstacles {
		t.Errorf("Obstacles were not set correctly")
	}

}
