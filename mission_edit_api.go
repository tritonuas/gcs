package main

import (
	"github.com/golang/protobuf/ptypes/empty"
	pb "github.com/tritonuas/hub/interop"
	"golang.org/x/net/context"
)

type missionEditServer struct {
	mission_folder string
}

func (s *missionEditServer) GetMissionList(context.Context, *empty.Empty) (*pb.MissionNameList, error) {
	list := get_missionlist(s.mission_folder)
	return &pb.MissionNameList{MissionNameList: list}, nil
}

func (s *missionEditServer) GetMission(ctx context.Context, mission_name *pb.MissionName) (*pb.CompleteMission, error) {
	return get_mission(s.mission_folder, mission_name.MissionName)
}

func (s *missionEditServer) PostMission(ctx context.Context, mission *pb.CompleteMission) (*empty.Empty, error) {
	return &empty.Empty{}, edit_mission(s.mission_folder, mission)
}
