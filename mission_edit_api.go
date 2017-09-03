package main

import (
	"github.com/golang/protobuf/ptypes/empty"
	pb "gitlab.com/tuas/tritongcs/hub/interop"
	"golang.org/x/net/context"
	"net/http"
	"strings"
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

func preflightHandler(w http.ResponseWriter, r *http.Request) {
	headers := []string{"Content-Type", "Accept"}
	w.Header().Set("Access-Control-Allow-Headers", strings.Join(headers, ","))
	methods := []string{"GET", "HEAD", "POST", "PUT", "DELETE"}
	w.Header().Set("Access-Control-Allow-Methods", strings.Join(methods, ","))
	return
}

func allowCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := r.Header.Get("Origin"); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			if r.Method == "OPTIONS" && r.Header.Get("Access-Control-Request-Method") != "" {
				preflightHandler(w, r)
				return
			}
		}
		h.ServeHTTP(w, r)
	})
}
