package interopconn

import (
	//"encoding/json"
	"math"
	"time"

	pb "github.com/tritonuas/hub/interop"
	"errors"
	"sync"
	"fmt"

	main "github.com/tritonuas/hub/hub_def"
	zmq "github.com/pebbe/zmq4"
	"github.com/golang/protobuf/jsonpb" 
)

func distanceMovingObstacle(t1 *pb.MovingObstacle, t2 IWaypoint) float32 {
	return waypointDistanceRaw(float32(t1.GetLatitude()), float32(t1.GetLongitude()), float32(t1.GetAltitudeMsl()), float32(t2.GetLatitude()), float32(t2.GetLongitude()), float32(t2.GetAltitudeMsl())) - float32(t1.GetSphereRadius())
}

func distanceStationaryObstacle(obs *pb.StationaryObstacle, wp IWaypoint) float32 {
	circleAlt := float32(math.Min(float64(obs.GetCylinderHeight()), float64(wp.GetAltitudeMsl())))
	return waypointDistanceRaw(float32(obs.GetLatitude()), float32(obs.GetLongitude()), circleAlt, float32(wp.GetLatitude()), float32(wp.GetLongitude()), float32(wp.GetAltitudeMsl())) - float32(obs.GetCylinderRadius())
}

func createDistanceStatus(length int) []*pb.DistanceStatus {
	output := make([]*pb.DistanceStatus, 0)
	for i := 0; i < length; i++ {
		output = append(output, &pb.DistanceStatus{ClosestDist: 1e8, CurrentDist: 1e8})
	}
	return output
}

type MissionReport struct {
	name string

	mission *pb.Mission

	obstacles *pb.Obstacles

	missionReportStatus pb.MissionReportStatus

	interop *InteropReport

	started bool

	obstacle_stream (chan *pb.Obstacles)

	gps_stream (chan interface{})

	report_topic *main.Topic

	obstacle_topic *main.Topic

	mux sync.Mutex
}

func (u *MissionReport) Status() (*pb.MissionReportStatus, error) {
	if !u.started {
		return nil, errors.New("reporting not started")
	}
	return &u.missionReportStatus, nil
}

func (u *MissionReport) GetActiveMission() (*pb.Mission, error) {
	if u.mission == nil {
		mission, err := u.interop.GetMission()
		if err != nil {
			return nil, err
		}
		return mission, nil
	} else {
		return u.mission, nil
	}
}

func (u *MissionReport) GetObstacles() (*pb.Obstacles, error) {
	if u.obstacles == nil {
		obstacles, err := u.interop.GetObstacles()
		if err != nil {
			return nil, err
		}
		return obstacles, nil
	} else {
		return u.obstacles, nil
	}
}

func (u *MissionReport) Start() (error) {
	Log.Warning("START")
	mission, err := u.interop.GetMission()
	if err != nil {
		return err
	}

	obstacles, err := u.interop.GetObstacles()
	if err != nil {
		return err
	}

	Log.Warning("setMission")
	u.mux.Lock()
	defer u.mux.Unlock()
	u.setMission(mission, obstacles)
	return nil
}

func (u *MissionReport) setMission(mission *pb.Mission, obstacles *pb.Obstacles) {
	// create correct distance status
	missionReportStatus := pb.MissionReportStatus{
		MissionWaypoints:    createDistanceStatus(len(mission.MissionWaypoints)),
		MovingObstacles:     createDistanceStatus(len(obstacles.MovingObstacles)),
		StationaryObstacles: createDistanceStatus(len(obstacles.StationaryObstacles)),
		AirdropPos:          &pb.DistanceStatus{ClosestDist: 1e8, CurrentDist: 1e8},
		EmergentPos:         &pb.DistanceStatus{ClosestDist: 1e8, CurrentDist: 1e8},
		Hz:                  0,
	}

	u.mission = mission
	u.obstacles = obstacles
	// race condition?
	u.missionReportStatus = missionReportStatus
	u.started = true
}

func setDistanceWaypoint(distanceStatus *pb.DistanceStatus, element IWaypoint64, waypoint IWaypoint) {
	distanceStatus.CurrentDist = WaypointDistance(element, waypoint)
	distanceStatus.ClosestDist = float32(math.Min(float64(distanceStatus.ClosestDist), float64(distanceStatus.CurrentDist)))
}

func setDistanceGps(distanceStatus *pb.DistanceStatus, element IGps64, waypoint IGps) {
	distanceStatus.CurrentDist = GpsDistance(element, waypoint)
	distanceStatus.ClosestDist = float32(math.Min(float64(distanceStatus.ClosestDist), float64(distanceStatus.CurrentDist)))
}

func (u *MissionReport) updateDistances(telem *pb.Telemetry) {
	u.mux.Lock()
	defer u.mux.Unlock()
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

func (u *MissionReport) run() {
	Log.Warning("start")
	ticker := time.NewTicker(time.Second)

    pubSocket, _ := zmq.NewSocket(zmq.PUB)
    pubSocket.Bind("127.0.0.1:6666")
	for {
		select {
			case obs_update:=  <- u.obstacle_stream:
				u.obstacle_topic.Send(obs_update)
				if !u.started {
					continue
				}
				u.obstacles = obs_update
			case gps_update:= <- u.gps_stream:
				
				gps := gps_update.(*pb.Telemetry)
				if u.started {
					u.updateDistances(gps)
				}
				go u.interop.PostTelemetry(gps)
			
			case <- ticker.C:
				u.report_topic.Send(&u.missionReportStatus)
                //Add zmq here to send to py-planner
			    convert := &pb.GCSMessage {
			    	GcsMessage: &pb.GCSMessage_MissionReport{
			    		MissionReport: &u.missionReportStatus,
			    	},
			    }

			    marshaler := jsonpb.Marshaler{
			    	OrigName:     true,
			    	EmitDefaults: true,
			    	Indent:       "    ",
			    }
                msg, err := marshaler.MarshalToString(convert)
			    if err != nil {
			    	Log.Error("error: ", err.Error())
			    }

                pubSocket.Send("mission_report", zmq.SNDMORE)
                pubSocket.Send(msg, 0)
		}
	}
}

func CreateMissionReportFull(urlBase string, username string, password string, obstacleRate int, gps_stream chan interface{}, report_topic *main.Topic, obstacle_topic *main.Topic) (*MissionReport){
	fmt.Println(urlBase)
	fmt.Println(username)
	fmt.Println(password)
	report := NewInteropReport(urlBase, username, password, obstacleRate)
	return createMissionReport(report, gps_stream, report_topic, obstacle_topic)
}

func createMissionReport(interop *InteropReport, gps_stream (chan interface{}), report_topic *main.Topic, obstacle_topic *main.Topic) *MissionReport {
	stream, _ := interop.ObstacleStream()
	backend := &MissionReport{interop: interop, obstacle_stream: stream, gps_stream: gps_stream, report_topic:report_topic, obstacle_topic:obstacle_topic}
	go backend.run()
	return backend
}
