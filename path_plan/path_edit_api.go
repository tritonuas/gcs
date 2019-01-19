package mission_edit

import (
	"github.com/golang/protobuf/ptypes/empty"
	pb "github.com/tritonuas/god/hub/interop"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	"fmt"
	"errors"
)

type PathPlanServer struct {
	path_folder string
	path_ip string
	path_port string
	current_path *pb.Path
	pathplan_addr string
}

func (s *PathPlanServer) GetPathList(context.Context, *empty.Empty) (*pb.MissionNameList, error) {
	list := get_pathlist(s.path_folder)
	return &pb.MissionNameList{MissionNameList: list}, nil
}

func (s *PathPlanServer) GetPath(ctx context.Context, path_name *pb.MissionName) (*pb.Path, error) {
	return get_path(s.path_folder, path_name.MissionName)
}

func (s *PathPlanServer) PostPath(ctx context.Context, path *pb.Path) (*empty.Empty, error) {
	return &empty.Empty{}, edit_path(s.path_folder, path)
}

func (s *PathPlanServer) SendPath(ctx context.Context, path *pb.Path) (*pb.GCSAction, error) {
	s.current_path = path
	return &pb.GCSAction{}, nil
}

func (s *PathPlanServer) GetPathFinal(context.Context, *empty.Empty) (*pb.Path, error) {
	returnpath := s.current_path
	if returnpath == nil {
		return nil, errors.New("no path set")
	}
	return returnpath, nil
}

func (s *PathPlanServer) PlanPath(ctx context.Context, obstacles *pb.Obstacles) (*pb.Path, error) {
	conn, err := grpc.Dial(s.pathplan_addr, grpc.WithInsecure())
	if err != nil {
		return nil, err
	}
	client := pb.NewPathPlannerClient(conn)
	path, err := client.PlanPath(context.Background(), obstacles)
	if err != nil {
		return nil, err
	}	
	conn.Close()
	return path, nil
}
func (s *PathPlanServer) StartPathPlanner(ctx context.Context, mission *pb.Mission) (*pb.GCSAction, error) {
	conn, err := grpc.Dial(s.pathplan_addr, grpc.WithInsecure())
	if err != nil {
		fmt.Println("conn error")
		return nil, err
	}
	fmt.Println(mission.HomePos)
	fmt.Println(mission.Id)
	client := pb.NewPathPlannerClient(conn)
	action, err := client.StartPathPlanner(context.Background(), mission)
	if err != nil {
			fmt.Println("action error")
			return nil, err
	}
	conn.Close()
	return action, nil
}

func CreatePathPlanServer(path_folder string, pathplan_addr string) (*PathPlanServer) {
	return &PathPlanServer{path_folder:path_folder, pathplan_addr:pathplan_addr}
}