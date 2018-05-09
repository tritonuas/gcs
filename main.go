package main

import (
	"flag"

	"fmt"
	"github.com/Sirupsen/logrus"
	"github.com/kardianos/osext"
	"net"
	"net/http"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	"github.com/rs/cors"
	pb "github.com/tritonuas/hub/interop"
	"golang.org/x/net/context"
	"google.golang.org/grpc"

	interopconn "github.com/tritonuas/hub/interopconn"
	missionedit "github.com/tritonuas/hub/mission_edit"
	hub "github.com/tritonuas/hub/hub_def"
)

var Log *logrus.Logger

var addr = flag.String("addr", ":5001", "http service address")
var hubpath = flag.String("hubpath", "../src/github.com/tritonuas/hub/", "Path to hub folder")
var interop_ip = flag.String("interop_ip", "127.0.0.1", "ip of interop computer")
var interop_port = flag.String("interop_port", "8000", "ip of interop computer")
var interop_username = flag.String("interop_username", "ucsdauvsi", "ip of interop computer")
var interop_pass = flag.String("interop_pass", "tritons", "ip of interop computer")
var sitl = flag.Bool("sitl", false, "running using only one computer/mavproxy")
var ip = flag.String("ip", "*", "ip of interop computer")
var debug = flag.Bool("debug", false, "a bool")

func main() {
	flag.Parse()
	Log = logrus.New()
	if *debug {
		Log.Level = logrus.DebugLevel
	}

	interopconn.Log = Log
	missionedit.Log = Log
	hub.Log = Log

	executable_folder, _ := osext.ExecutableFolder()

	missionfolder := get_path(executable_folder, *hubpath, "missions/")
	swaggerfolder := get_path(executable_folder, *hubpath, "third_party/swagger-ui/")

	setupHelpers(missionfolder)

	Log.Info("Start Hub")

	cur_hub := hub.CreateHub()
	
	// Create Topics
	Log.Info("hello")
	cur_hub.AddTopic("telemetry")
	Log.Info("hello")
	cur_hub.AddTopic("obstacle_data")
	cur_hub.AddTopic("mission_status")
	cur_hub.AddTopic("plane_obc_data")

	go listenAndServe(":5760", cur_hub.Topics["telemetry"])

	createUDPBackend(cur_hub.Topics["plane_obc_data"], ":5555")

	mux := http.NewServeMux()

	mux.HandleFunc("/websocket/gcs", func(w http.ResponseWriter, r *http.Request) {
		serveWs(nil, cur_hub.Topics["mission_status"].Subscriber(100), w, r)
	})

	mux.HandleFunc("/websocket/obc", func(w http.ResponseWriter, r *http.Request) {
		serveWs(cur_hub.Topics["plane_obc_data"].Subscriber(100), nil, w, r)
	})

	Log.Info("hello")

	swaggerassets := http.StripPrefix("/swagger/", http.FileServer(http.Dir(swaggerfolder)))
	mux.Handle("/swagger/", swaggerassets)

	mission_report := interopconn.CreateMissionReportFull("http://127.0.0.1:8000", "ucsdauvsi", "tritons", 1, cur_hub.Topics["telemetry"].Subscriber(100), cur_hub.Topics["mission_status"])

	grpcServer := grpc.NewServer()
	pb.RegisterMissionEditServer(grpcServer, missionedit.CreateMissionEdit(missionfolder))
	pb.RegisterInteropServer(grpcServer, interopconn.CreateInteropServer(mission_report))

	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	gwmux := runtime.NewServeMux(runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{OrigName: true, EmitDefaults: true}))

	mux.Handle("/", gwmux)
	dopts := []grpc.DialOption{grpc.WithInsecure()}
	err := pb.RegisterMissionEditHandlerFromEndpoint(ctx, gwmux, *addr, dopts)
	err = pb.RegisterInteropHandlerFromEndpoint(ctx, gwmux, *addr, dopts)
	if err != nil {
		Log.Info(err)
		return
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", 5001))
	if err != nil {
		Log.Info("failed to listen: %v", err)
	}
	go grpcServer.Serve(lis)
	handler := cors.Default().Handler(mux)
	http.ListenAndServe(":5000", handler)

	if err != nil {
		Log.Fatal("ListenAndServe: ", err)
	}

}
