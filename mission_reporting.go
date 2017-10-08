package main

import (
	"bytes"
	"encoding/json"
	"math"
	"time"

	"github.com/golang/protobuf/jsonpb"

	pb "github.com/tritonuas/hub/interop"
)

type MissionReportingBackend struct {
	hub *Hub

	send chan []byte

	name string

	mission *pb.Mission

	obstacles *pb.Obstacles

	missionReportStatus pb.MissionReportStatus
}

func distanceMovingObstacle(t1 *pb.MovingObstacle, t2 IWaypoint) float32 {
	return waypointDistanceRaw(t1.GetLatitude(), t1.GetLongitude(), t1.GetAltitudeMsl(), t2.GetLatitude(), t2.GetLongitude(), t2.GetAltitudeMsl()) - t1.GetSphereRadius()
}

func distanceStationaryObstacle(obs *pb.StationaryObstacle, wp IWaypoint) float32 {
	circleAlt := float32(math.Min(float64(obs.GetCylinderHeight()), float64(wp.GetAltitudeMsl())))
	return waypointDistanceRaw(obs.GetLatitude(), obs.GetLongitude(), circleAlt, wp.GetLatitude(), wp.GetLongitude(), wp.GetAltitudeMsl()) - obs.GetCylinderRadius()
}

func (u *MissionReportingBackend) Name() string {
	return u.name
}

func (u *MissionReportingBackend) Connected() bool {
	return true
}

func (u *MissionReportingBackend) Send(message []byte) bool {
	select {
	case u.send <- message:
		return true
	default:
		return false
	}
}

func (u *MissionReportingBackend) Sender() {
	for {
		s := u.missionReportStatus
		b, err := json.Marshal(s)
		if err != nil {
			Log.Error(err)
			continue
		}
		u.hub.sendEndpointMessage(b, "gcs")
		time.Sleep(time.Second * 1)
	}
}

func createDistanceStatus(length int) []*pb.DistanceStatus {
	output := make([]*pb.DistanceStatus, 0)
	for i := 0; i < length; i++ {
		output = append(output, &pb.DistanceStatus{ClosestDist: 1e8, CurrentDist: 1e8})
	}
	return output
}

func (u *MissionReportingBackend) SetMission(mission *pb.Mission, obstacles *pb.Obstacles) {
	// create correct distance status
	missionReportStatus := pb.MissionReportStatus{
		MissionWaypoints:    createDistanceStatus(len(mission.MissionWaypoints)),
		MovingObstacles:     createDistanceStatus(len(obstacles.StationaryObstacles)),
		StationaryObstacles: createDistanceStatus(len(obstacles.MovingObstacles)),
		AirdropPos:          &pb.DistanceStatus{ClosestDist: 1e8, CurrentDist: 1e8},
		EmergentPos:         &pb.DistanceStatus{ClosestDist: 1e8, CurrentDist: 1e8},
	}

	u.mission = mission
	u.obstacles = obstacles
	// race condition?
	u.missionReportStatus = missionReportStatus
}

func setDistanceWaypoint(distanceStatus *pb.DistanceStatus, element IWaypoint, waypoint IWaypoint) {
	distanceStatus.CurrentDist = WaypointDistance(element, waypoint)
	distanceStatus.ClosestDist = float32(math.Min(float64(distanceStatus.ClosestDist), float64(distanceStatus.CurrentDist)))
}

func setDistanceGps(distanceStatus *pb.DistanceStatus, element IGps, waypoint IGps) {
	distanceStatus.CurrentDist = GpsDistance(element, waypoint)
	distanceStatus.ClosestDist = float32(math.Min(float64(distanceStatus.ClosestDist), float64(distanceStatus.CurrentDist)))
}

func (u *MissionReportingBackend) UpdateDistances(telem *pb.Telemetry) {
	// set waypoints and airdrop
	for index, distanceStatus := range u.missionReportStatus.MissionWaypoints {
		setDistanceWaypoint(distanceStatus, u.mission.MissionWaypoints[index], telem)
	}
	setDistanceGps(u.missionReportStatus.AirdropPos, u.mission.AirDropPos, telem)
	setDistanceGps(u.missionReportStatus.EmergentPos, u.mission.AirDropPos, telem)
	for index, distanceStatus := range u.missionReportStatus.MissionWaypoints {
		setDistanceWaypoint(distanceStatus, u.mission.MissionWaypoints[index], telem)
	}
	for index, distanceStatus := range u.missionReportStatus.StationaryObstacles {
		distanceStatus.CurrentDist = distanceStationaryObstacle(u.obstacles.GetStationaryObstacles()[index], telem)
		distanceStatus.ClosestDist = float32(math.Min(float64(distanceStatus.ClosestDist), float64(distanceStatus.CurrentDist)))
	}
	for index, distanceStatus := range u.missionReportStatus.MovingObstacles {
		distanceStatus.CurrentDist = distanceMovingObstacle(u.obstacles.GetMovingObstacles()[index], telem)
		distanceStatus.ClosestDist = float32(math.Min(float64(distanceStatus.ClosestDist), float64(distanceStatus.CurrentDist)))
	}
}

func (u *MissionReportingBackend) Run() {
	go u.Sender()
	for {
		select {
		case msg := <-u.send:
			if u.mission == nil {
				continue
			}
			marshaller := jsonpb.Unmarshaler{AllowUnknownFields: false}
			telem := &pb.Telemetry{}
			err := marshaller.Unmarshal(bytes.NewReader(msg), telem)
			if err == nil {
				u.UpdateDistances(telem)
			} else {
				obstacles := &pb.Obstacles{}

				// Check Error essage
				err := marshaller.Unmarshal(bytes.NewReader(msg), obstacles)
				if err != nil {
					Log.Error("parse error obstacles")
					continue
				}
				u.obstacles = obstacles
			}
		}
	}
}

func (u *MissionReportingBackend) Close() {
	close(u.send)
}

func createMissionReportingBackend(name string, hub *Hub) *MissionReportingBackend {
	backend := &MissionReportingBackend{name: name, hub: hub, send: make(chan []byte, 1024)}
	return backend
}
