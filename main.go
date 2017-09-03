package main

import (
	"flag"
	"github.com/Sirupsen/logrus"
	"github.com/kardianos/osext"
	//"log"
	"net/http"
	//"time"
	//"golang.org/x/time/rate"
	"fmt"
	"net"
	"strings"

	"github.com/grpc-ecosystem/grpc-gateway/runtime"
	pb "gitlab.com/tuas/tritongcs/hub/interop"
	"golang.org/x/net/context"
	"google.golang.org/grpc"
	//"gitlab.com/tuas/tritongcs/hub/certs"
	//"crypto/tls"
	//"crypto/x509"
	//"google.golang.org/grpc/credentials"
)

var Log *logrus.Logger
var addr = flag.String("addr", ":5001", "http service address")
var hubpath = flag.String("hubpath", "../src/gitlab.com/tuas/tritongcs/hub/", "Path to hub folder")
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
	// folders stuff
	executable_folder, _ := osext.ExecutableFolder()

	missionfolder := get_path(executable_folder, *hubpath, "../missions/")
	obcfolder := get_path(executable_folder, *hubpath, "../client/PlaneOBC/build/")
	controlfolder := get_path(executable_folder, *hubpath, "../client/MissionControl/build/")
	imageoperatorfolder := get_path(executable_folder, *hubpath, "../client/ImageOperator/build/")
	swaggerfolder := get_path(executable_folder, *hubpath, "third_party/swagger-ui/")

	setupHelpers(missionfolder)

	Log.Info("Start Hub")

	hub := createHub()

	// Create Topics
	hub.topics["location"] = newTopic("location")
	hub.topics["mission_status"] = newTopic("mission_status")
	hub.topics["obstacle_data"] = newTopic("obstacle_data")
	hub.topics["plane_obc_data"] = newTopic("plane_obc_data")
	hub.topics["path_updates"] = newTopic("path_updates")

	// start the Hub topics
	for _, v := range hub.topics {
		go v.Run()
	}

	// Create Receivers
	planeobc := createUDPBackend(hub, ":5555")
	interopclient := createInteropClient(hub, "http://"+*interop_ip+":"+*interop_port, *interop_username, *interop_pass, 5)
	missionreporting := createMissionReportingBackend("Mission Reporint", hub)

	// Create Endpoints
	hub.endpoints["gcs"] = newTopic("gcsfrontend")
	hub.endpoints["obcfrontend"] = newTopic("obcfrontend")
	/*if !*sitl {
		hub.endpoints["dronekitproxyplane"] = createZMQPairBackend("dronekitproxyplane", hub, "tcp://"+*ip+":9000")
	}
	*/
	//hub.endpoints["dronekitproxy"] = createZMQPairBackend("dronekitproxy", hub, "tcp://"+*ip+":9001")
	//hub.endpoints["pathplanner"] = createZMQPushPullBackend("pathplanner", hub, "tcp://"+*ip+":17401", "tcp://"+*ip+":17400")
	hub.endpoints["interopclient"] = interopclient
	hub.endpoints["missionreporting"] = missionreporting
	hub.missionreporting = missionreporting

	// Register Topic clients
	hub.topics["location"].register <- newStreamClient(hub.endpoints["gcs"], 3.0)
	//hub.topics["location"].register <- newStreamClient(hub.endpoints["pathplanner"], 1.0)
	hub.topics["location"].register <- newStreamClient(hub.endpoints["interopclient"], 15.0)
	hub.topics["location"].register <- newStreamClient(missionreporting, 10.0)

	hub.topics["mission_status"].register <- newStreamClient(hub.endpoints["gcs"], 1.0)
	//hub.topics["mission_status"].register <- newStreamClient(hub.endpoints["pathplanner"], rate.Inf)

	hub.topics["obstacle_data"].register <- newStreamClient(hub.endpoints["gcs"], 2.0)
	//hub.topics["obstacle_data"].register <- newStreamClient(hub.endpoints["pathplanner"], 4.0)
	hub.topics["obstacle_data"].register <- newStreamClient(missionreporting, 10.0)

	hub.topics["path_updates"].register <- newStreamClient(hub.endpoints["gcs"], 10000.0)
	//hub.topics["path_updates"].register <- newStreamClient(hub.endpoints["pathplanner"], 5.0)
	if !*sitl {
		hub.topics["path_updates"].register <- newStreamClient(hub.endpoints["dronekitproxyplane"], 10000.0)
	} else {
		//hub.topics["path_updates"].register <- newStreamClient(hub.endpoints["dronekitproxy"], 10000.0)
	}

	hub.topics["plane_obc_data"].register <- newStreamClient(hub.endpoints["obcfrontend"], 2.0)

	statusUpdates := make([]Status, 2)
	statusUpdates[0] = planeobc
	statusUpdates[1] = interopclient

	// Start Topics
	go planeobc.Run()

	for _, v := range hub.endpoints {
		go v.Run()
	}

	// go printStatus(hub, statusUpdates)

	mux := http.NewServeMux()

	// Setup Frontends
	mux.HandleFunc("/obc/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, hub.endpoints["obcfrontend"].(*Topic), w, r)
	})

	mux.HandleFunc("/gcs/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, hub.endpoints["gcs"].(*Topic), w, r)
	})

	mux.HandleFunc("/interop/mission/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		interopclient.getMission(w, r)
	})

	obcassets := http.StripPrefix("/obccontrol/", http.FileServer(http.Dir(obcfolder)))
	mux.Handle("/obccontrol/", obcassets)

	mcontrolassets := http.StripPrefix("/missioncontrol/", http.FileServer(http.Dir(controlfolder)))
	mux.Handle("/missioncontrol/", mcontrolassets)

	operatorassets := http.StripPrefix("/imageoperator/", http.FileServer(http.Dir(imageoperatorfolder)))
	mux.Handle("/imageoperator/", operatorassets)

	swaggerassets := http.StripPrefix("/swagger/", http.FileServer(http.Dir(swaggerfolder)))
	mux.Handle("/swagger/", swaggerassets)

	/*err = http.ListenAndServe(*addr, nil)
	if err != nil {
		Log.Fatal("ListenAndServe: ", err)
	}
	*/
	// load certs
	/*pair, err := tls.X509KeyPair([]byte(certs.Cert), []byte(certs.Key))
	if err != nil {
		panic(err)
	}
	demoKeyPair := &pair
	demoCertPool := x509.NewCertPool()
	ok := demoCertPool.AppendCertsFromPEM([]byte(certs.Cert))
	if !ok {
		panic("bad certs")
	}
	opts := []grpc.ServerOption{
		grpc.Creds(credentials.NewClientTLSFromCert(demoCertPool, *addr))}
	*/

	grpcServer := grpc.NewServer()
	pb.RegisterMissionEditServer(grpcServer, &missionEditServer{mission_folder: missionfolder})

	ctx := context.Background()
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	gwmux := runtime.NewServeMux(runtime.WithMarshalerOption(runtime.MIMEWildcard, &runtime.JSONPb{OrigName: true, EmitDefaults: true}))
	/*dcreds := credentials.NewTLS(&tls.Config{
		ServerName: *addr,
		RootCAs:    demoCertPool,
	})
	*/
	mux.Handle("/", gwmux)
	dopts := []grpc.DialOption{grpc.WithInsecure()}
	err := pb.RegisterMissionEditHandlerFromEndpoint(ctx, gwmux, *addr, dopts)
	if err != nil {
		Log.Info(err)
		return
	}
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", 5001))
	if err != nil {
		Log.Info("failed to listen: %v", err)
	}
	go grpcServer.Serve(lis)
	http.ListenAndServe(":5000", allowCORS(mux))

	if err != nil {
		Log.Fatal("ListenAndServe: ", err)
	}

}

// grpcHandlerFunc returns an http.Handler that delegates to grpcServer on incoming gRPC
// connections or otherHandler otherwise. Copied from cockroachdb.
func grpcHandlerFunc(grpcServer *grpc.Server, otherHandler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO(tamird): point to merged gRPC code rather than a PR.
		// This is a partial recreation of gRPC's internal checks https://github.com/grpc/grpc-go/pull/514/files#diff-95e9a25b738459a2d3030e1e6fa2a718R61
		if r.ProtoMajor == 2 && strings.Contains(r.Header.Get("Content-Type"), "application/grpc") {
			Log.Info("grpc")
			grpcServer.ServeHTTP(w, r)
		} else {
			Log.Info("other")
			otherHandler.ServeHTTP(w, r)
		}
	})
}
