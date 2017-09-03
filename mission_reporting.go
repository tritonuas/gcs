package main

import (
	//"github.com/Sirupsen/logrus"
	"encoding/json"
	"math"
	"time"
)

type GPS struct {
	lat float64
	lng float64
	alt float64
}

type MovingObstacle struct {
	AltitudeMSL  float64 `json:"altitude_msl"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	SphereRadius float64 `json:"sphere_radius"`
}

type StationaryObstacle struct {
	CylinderHeight float64 `json:"cylinder_height"`
	CylinderRadius float64 `json:"cylinder_radius"`
	Latitude       float64 `json:"latitude"`
	Longitude      float64 `json:"longitude"`
}

type ObstacleRec struct {
	MovingObstacles     []*MovingObstacle     `json:"moving_obstacles"`
	StationaryObstacles []*StationaryObstacle `json:"stationary_obstacles"`
}

type MissionReportingBackend struct {
	hub *Hub

	send chan []byte

	name string

	mission_set bool

	waypoints []*Telemetry

	airdrop *Telemetry

	emergent *Telemetry

	Obstacles *ObstacleRec

	Waypoints_dist []*DistanceStruct `json:"waypoint_dist"`

	Airdrop_dist *DistanceStruct `json:"airdrop_dist"`

	Emergent_dist *DistanceStruct `json:"emergent_dist"`

	Stationary_dist []*DistanceStruct `json:"stationary_obs_dist"`

	Moving_dist []*DistanceStruct `json:"moving_obs_dist"`
}

type DistanceStruct struct {
	Closest float64 `json:"closest"`
	Current float64 `json:"current"`
}

type MissionReportingSend struct {
	Type string                   `json:"type"`
	Data *MissionReportingBackend `json:"data"`
}

func distance_to_telem(t1, t2 *Telemetry) float64 {
	return distance_to(t1.latitude, t1.longitude, t1.altitude_msl, t2.latitude, t2.longitude, t2.altitude_msl)
}

func distance_to_gps_telem(t1, t2 *Telemetry) float64 {
	return distance_to(t1.latitude, t1.longitude, 0, t2.latitude, t2.longitude, 0)
}

func distance_to_gps_telem_moving_obs(t1 *MovingObstacle, t2 *Telemetry) float64 {
	return distance_to(t1.Latitude, t1.Longitude, t1.AltitudeMSL, t2.latitude, t2.longitude, t2.altitude_msl) - t1.SphereRadius
}

func distance_to_gps_telem_stationary_obs(obs *StationaryObstacle, plane *Telemetry) float64 {

	calculated_circle_alt := math.Min(obs.CylinderHeight, plane.altitude_msl)

	return distance_to(obs.Latitude, obs.Longitude, calculated_circle_alt, plane.latitude, plane.longitude, plane.altitude_msl) - obs.CylinderRadius
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
		s := MissionReportingSend{Type: "MISSION_REPORTING_STATUS", Data: u}
		b, err := json.Marshal(s)
		if err != nil {
			Log.Info(err)
			continue
		}
		u.hub.sendEndpointMessage(b, "gcs")
		time.Sleep(time.Second * 1)
	}
}

func (u *MissionReportingBackend) SetMission(mission []byte) {
	if u.mission_set == true {
		return
	}
	var loc map[string]interface{}
	err := json.Unmarshal(mission, &loc)
	if err != nil {
		Log.Warning("MissionReportingBackend.Run(): json decode error - ", err)
		return
	}
	var dat map[string]interface{}

	// set airdrop position
	Log.Info(loc["airdrop_pos"])
	dat = loc["air_drop_pos"].(map[string]interface{})
	var telemData = new(Telemetry)
	telemData.latitude = dat["latitude"].(float64)
	telemData.longitude = dat["longitude"].(float64)
	telemData.altitude_msl = 0
	telemData.uas_heading = 0
	u.airdrop = telemData

	dat = loc["emergent_last_known_pos"].(map[string]interface{})
	var telemEmergent = new(Telemetry)
	telemEmergent.latitude = dat["latitude"].(float64)
	telemEmergent.longitude = dat["longitude"].(float64)
	telemEmergent.altitude_msl = 0
	telemEmergent.uas_heading = 0
	u.emergent = telemEmergent

	var wp []interface{}

	wp = loc["mission_waypoints"].([]interface{})
	for _, element := range wp {
		var dat map[string]interface{}
		dat = element.(map[string]interface{})
		var telemData = new(Telemetry)
		telemData.latitude = dat["latitude"].(float64)
		telemData.longitude = dat["longitude"].(float64)
		telemData.altitude_msl = dat["altitude_msl"].(float64)
		telemData.uas_heading = 0
		u.Waypoints_dist = append(u.Waypoints_dist, &DistanceStruct{Closest: 1e8, Current: 1e8})
		u.waypoints = append(u.waypoints, telemData)

	}
	u.mission_set = true
}

func (u *MissionReportingBackend) Run() {
	go u.Sender()
	for {
		select {
		// Receive gps updates
		case msg := <-u.send:
			var loc map[string]interface{}
			err := json.Unmarshal(msg, &loc)
			if err != nil {
				Log.Warning("MissionReportingBackend.Run(): json decode error - ", err)
				continue
			}
			if _, ok := loc["data"]; ok {

				var dat map[string]interface{}
				dat = loc["data"].(map[string]interface{})
				var telemData = new(Telemetry)
				telemData.latitude = dat["lat"].(float64)
				telemData.longitude = dat["lon"].(float64)
				telemData.altitude_msl = dat["a_rel"].(float64)
				telemData.uas_heading = dat["head"].(float64)

				// set waypoints and airdrop
				for index, element := range u.waypoints {
					u.Waypoints_dist[index].Current = distance_to_telem(element, telemData)
					u.Waypoints_dist[index].Closest = math.Min(u.Waypoints_dist[index].Current, u.Waypoints_dist[index].Closest)
				}
				if u.airdrop != nil {
					u.Airdrop_dist.Current = distance_to_gps_telem(u.airdrop, telemData)
					u.Airdrop_dist.Closest = math.Min(u.Airdrop_dist.Current, u.Airdrop_dist.Closest)
				}
				if u.emergent != nil {
					u.Emergent_dist.Current = distance_to_gps_telem(u.emergent, telemData)
					u.Emergent_dist.Closest = math.Min(u.Emergent_dist.Current, u.Emergent_dist.Closest)
				}
				if u.Obstacles != nil {
					for index, element := range u.Obstacles.MovingObstacles {

						u.Moving_dist[index].Current = distance_to_gps_telem_moving_obs(element, telemData)
						u.Moving_dist[index].Closest = math.Min(u.Moving_dist[index].Current, u.Moving_dist[index].Closest)

					}
					// WORK ON THIS PART
					for index, element := range u.Obstacles.StationaryObstacles {

						u.Stationary_dist[index].Current = distance_to_gps_telem_stationary_obs(element, telemData)
						u.Stationary_dist[index].Closest = math.Min(u.Stationary_dist[index].Current, u.Stationary_dist[index].Closest)
					}
				}
			} else {
				// Marshall into struct ObstacleRec
				obstaclerec := &ObstacleRec{}

				// Check Error essage
				err := json.Unmarshal(msg, obstaclerec)
				if err != nil {
					Log.Warning("parse error obstacles")
					break
				}

				// Initialize distance list to same size as stationary obstacle list
				if u.Obstacles == nil {
					for _, _ = range obstaclerec.MovingObstacles {
						u.Moving_dist = append(u.Moving_dist, &DistanceStruct{Closest: 1e8, Current: 1e8})
					}

					for _, _ = range obstaclerec.StationaryObstacles {
						u.Stationary_dist = append(u.Stationary_dist, &DistanceStruct{Closest: 1e8, Current: 1e8})
					}
				}

				u.Obstacles = obstaclerec

			}
		}
	}
}

func (u *MissionReportingBackend) Close() {
	close(u.send)
}

func createMissionReportingBackend(name string, hub *Hub) *MissionReportingBackend {
	backend := &MissionReportingBackend{name: name, hub: hub, Obstacles: nil, waypoints: make([]*Telemetry, 0), airdrop: nil, emergent: nil, mission_set: false, send: make(chan []byte, 1024), Waypoints_dist: make([]*DistanceStruct, 0), Stationary_dist: make([]*DistanceStruct, 0), Moving_dist: make([]*DistanceStruct, 0), Airdrop_dist: &DistanceStruct{Closest: 1e8, Current: 1e8}, Emergent_dist: &DistanceStruct{Closest: 1e8, Current: 1e8}}
	return backend
}
