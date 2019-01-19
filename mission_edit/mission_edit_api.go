package mission_edit

import (
	"github.com/golang/protobuf/ptypes/empty"
	pb "github.com/tritonuas/god/hub/interop"
	"golang.org/x/net/context"
)

type MissionEditServer struct {
	mission_folder string
}

func (s *MissionEditServer) GetMissionList(context.Context, *empty.Empty) (*pb.MissionNameList, error) {
	list := get_missionlist(s.mission_folder)
	return &pb.MissionNameList{MissionNameList: list}, nil
}

func (s *MissionEditServer) GetMission(ctx context.Context, mission_name *pb.MissionName) (*pb.CompleteMission, error) {
	return get_mission(s.mission_folder, mission_name.MissionName)
}

func (s *MissionEditServer) PostMission(ctx context.Context, mission *pb.CompleteMission) (*empty.Empty, error) {
	return &empty.Empty{}, edit_mission(s.mission_folder, mission)
}

func CreateMissionEdit(mission_folder string) (*MissionEditServer) {
	return &MissionEditServer{mission_folder:mission_folder}
}