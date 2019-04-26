package main

import (
	"github.com/namsral/flag"


  "os"
	"fmt"
	"github.com/Sirupsen/logrus"
	//"github.com/kardianos/osext"
	"net"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"github.com/rs/cors"
	pb "github.com/tritonuas/hub/interop"
	//pb "github.com/tritonuas/protos/interop"
	"golang.org/x/net/context"
	"google.golang.org/grpc"

	interopconn "github.com/tritonuas/hub/interopconn"
	missionedit "github.com/tritonuas/hub/mission_edit"
	pathplan "github.com/tritonuas/hub/path_plan"
	hub "github.com/tritonuas/hub/hub_def"
)

var Log *logrus.Logger

var hub_addr = flag.String("hub_addr", "5001", "http service hub_address")
var hub_path = flag.String("hub_path", "/home/mat/gopath/src/github.com/tritonuas/hub", "Path to hub folder")
var interop_ip = flag.String("interop_ip", "127.0.0.1", "ip of interop computer")
var interop_port = flag.String("interop_port", "8000", "ip of interop computer")
var interop_user = flag.String("interop_user", "ucsdauvsi", "ip of interop computer")
var interop_pass = flag.String("interop_pass", "tritons", "ip of interop computer")
var mav_device = flag.String("mav_device", ":5761", "mav device")
var ip = flag.String("ip", "*", "ip of interop computer")
var debug = flag.Bool("debug", false, "a bool")
var socket_addr = flag.String("socket_addr", "127.0.0.1:6667", "ip + port of path planner zmq")
var env_var = flag.Bool("env_var", false, "use environment variables")

func main() {
	flag.Parse()
  if *env_var {
    var env = os.Getenv("HUB_PATH")
    if len(env) > 0 {
      *hub_path = env
    }
    env = os.Getenv("INTEROP_IP")
    if len(env) > 0 {
      *interop_ip = env
    }
    env = os.Getenv("INTEROP_PORT")
    if len(env) > 0 {
      *interop_port = env
    }
    env = os.Getenv("INTEROP_USER")
    if len(env) > 0 {
      *interop_user = env
    }
    env = os.Getenv("MAV_DEVICE")
    if len(env) > 0 {
      *mav_device = env
    }
  }
	Log = logrus.New()
	if *debug {
		Log.Level = logrus.DebugLevel
	}

	interopconn.Log = Log
	missionedit.Log = Log
	hub.Log = Log
	Log.Info("MARCO")
	//_, _ := osext.ExecutableFolder()
	Log.Warning(*hub_path)
	missionfolder := get_path("", *hub_path, "/missions/")
	pathfolder := get_path("", *hub_path, "/paths/")
	swaggerfolder := get_path("", *hub_path, "/third_party/swagger-ui/")
	Log.Warning(missionfolder)
	setupHelpers(missionfolder)

	Log.Info("Start Hub")

	cur_hub := hub.CreateHub()
	
	// Create Topics
	Log.Info("hello")
	cur_hub.AddTopic("telemetry")
	cur_hub.AddTopic("plane_loc")
	cur_hub.AddTopic("plane_status")
	Log.Info("hello")
	cur_hub.AddTopic("obstacle_data")
	cur_hub.AddTopic("mission_status")
	cur_hub.AddTopic("plane_obc_data")

	go listenAndServe(*mav_device, cur_hub.Topics["telemetry"], cur_hub.Topics["plane_loc"], cur_hub.Topics["plane_status"], *socket_addr)

	createUDPBackend(cur_hub.Topics["plane_obc_data"], ":5555")

	mux := http.NewServeMux()

	mux.HandleFunc("/websocket/gcs", func(w http.ResponseWriter, r *http.Request) {
		serveWs(nil, cur_hub.Topics["mission_status"].Subscriber(100), cur_hub.Topics["plane_loc"].Subscriber(3), cur_hub.Topics["plane_status"].Subscriber(1),cur_hub.Topics["obstacle_data"].Subscriber(1), w, r)
	})

	mux.HandleFunc("/websocket/obc", func(w http.ResponseWriter, r *http.Request) {
		serveWs(cur_hub.Topics["plane_obc_data"].Subscriber(100), nil, nil, nil,nil, w, r)
	})

	Log.Info("hello")

	swaggerassets := http.StripPrefix("/swagger/", http.FileServer(http.Dir(swaggerfolder)))
	mux.Handle("/swagger/", swaggerassets)
	Log.Info(string(*interop_ip))
	Log.Info(*interop_port)
	Log.Info(*interop_user)
	Log.Info(*interop_pass)
	mission_report := interopconn.CreateMissionReportFull("http://"+string(*interop_ip)+":"+*interop_port, *interop_user, *interop_pass, 1, cur_hub.Topics["telemetry"].Subscriber(100), cur_hub.Topics["mission_status"], cur_hub.Topics["obstacle_data"])

	Log.Info("continue")

	grpcServer := grpc.NewServer()
	pb.RegisterMissionEditServer(grpcServer, missionedit.CreateMissionEdit(missionfolder))
	pb.RegisterInteropServer(grpcServer, interopconn.CreateInteropServer(mission_report))
	Log.Info(pathfolder)
	pb.RegisterPathPlannerServer(grpcServer, pathplan.CreatePathPlanServer(pathfolder, "192.168.1.8:6666"))

	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	gwmux := runtime.NewServeMux(runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{OrigName: true, EmitDefaults: true}))

	mux.Handle("/", gwmux)
	dopts := []grpc.DialOption{grpc.WithInsecure()}
	err := pb.RegisterMissionEditHandlerFromEndpoint(ctx, gwmux, ":"+*hub_addr, dopts)
	err = pb.RegisterInteropHandlerFromEndpoint(ctx, gwmux, ":"+*hub_addr, dopts)
	err = pb.RegisterPathPlannerHandlerFromEndpoint(ctx, gwmux, ":"+*hub_addr, dopts)
	if err != nil {
		Log.Info(err)
		return
	}

	Log.Info("listen")

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", 5001))
	if err != nil {
		Log.Info("failed to listen: %v", err)
	}
	go grpcServer.Serve(lis)
	handler := cors.Default().Handler(mux)
	http.ListenAndServe(":5000", handler)

	Log.Info("listen and serve")
	if err != nil {
		Log.Info("error")
		Log.Fatal("ListenAndServe: ", err)
	}
}
