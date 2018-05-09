package interopconn

import (

	pb "github.com/tritonuas/hub/interop"
	"github.com/golang/protobuf/ptypes/empty"
	"golang.org/x/net/context"
)

type InteropServer struct {
	missionReport *MissionReport
}

func (s *InteropServer) GetActiveMission(context.Context, *empty.Empty) (*pb.Mission, error) {
	return s.missionReport.GetActiveMission()
}

func (s *InteropServer) GetObstacles(context.Context, *empty.Empty) (*pb.Obstacles, error) {
	return s.missionReport.GetObstacles()
}

func (s *InteropServer) StartMission(context.Context, *empty.Empty) (*empty.Empty, error) {
	return &empty.Empty{}, s.missionReport.Start()
}

func (s *InteropServer) Status(context.Context, *empty.Empty) (*pb.MissionReportStatus, error) {
	return s.missionReport.Status()
}

func CreateInteropServer(missionReport *MissionReport) (*InteropServer) {
	return &InteropServer{missionReport: missionReport}
}