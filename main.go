package main

import (
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"
	ic "github.com/tritonuas/hub/internal/interop"
	hs "github.com/tritonuas/hub/internal/server"
	mav "github.com/tritonuas/hub/internal/mavlink"
)

var log = logrus.New()
var ENVS = map[string]*string{
	"HUB_ADDR":           flag.String("hub_addr", "5001", "http service hub_address"),
	"HUB_PATH":           flag.String("hub_path", "/home/mat/gopath/src/github.com/tritonuas/hub", "Path to hub folder"),
	"INTEROP_IP":         flag.String("interop_ip", "127.0.0.1", "ip of interop computer"),
	"INTEROP_PORT":       flag.String("interop_port", "8000", "port of interop computer"),
	"INTEROP_USER":       flag.String("interop_user", "ucsdauvsi", "username on interop computer"),
	"INTEROP_PASS":       flag.String("interop_pass", "tritons", "password to interop computer"),
	"INTEROP_TIMEOUT":    flag.String("interop_timeout", "10", "time limit in seconds on http requests to interop server"),
	"INTEROP_RETRY_TIME": flag.String("interop_retry_time", "5", "how many seconds to wait after unsuccessful interop authentication"),
	"MAV_DEVICE":         flag.String("mav_device", ":5761", "mav device"),
	"IP":                 flag.String("ip", "*", "ip of interop computer"),
	"SOCKET_ADDR":        flag.String("socket_addr", "127.0.0.1:6667", "ip + port of path planner zmq"),
	"DEBUG_MODE":         flag.String("debug", "False", "Boolean to determine logging mode"),
	"MAV_COMMON_PATH":    flag.String("mav_common_path", "mavlink/message_definitions/v1.0/common.xml", "path to file that contains common mavlink messages"),
	"MAV_ARDU_PATH": 	  flag.String("mav_ardu_path", "./mavlink/message_definitions/v1.0/ardupilotmega.xml", "path to file that contains ardupilot mavlink messages"),
}

// setEnvVars will check for any hub related environment variables and
// override the initialized values to the environment variables.
func setEnvVars() {
	for _, element := range os.Environ() {
		pair := strings.SplitN(element, "=", 2)
		if _, ok := ENVS[pair[0]]; ok {
			log.Info(fmt.Sprintf("Setting ENVS[%s] = %s", pair[0], pair[1]))
			ENVS[pair[0]] = &pair[1]
		}
	}
}

// setLoggers will link together all of the loggers from submodules so
// that all logs go through a central logger.
// Add in other loggers for modules as needed
func setLoggers() {
	ic.Log = log
	mav.Log = log
}

func main() {
	setLoggers()
	setEnvVars()
	// prioritize command line flags over environment variables
	flag.Parse()

	if *ENVS["DEBUG_MODE"] == "True" {
		log.SetLevel(logrus.DebugLevel)
		log.Debug("Logging Mode: DEBUG")
	}

	// create client to interop
	interopRetryTime, _ := strconv.Atoi(*ENVS["INTEROP_RETRY_TIME"])
	interopTimeout, _ := strconv.Atoi(*ENVS["INTEROP_TIMEOUT"])
	interopURL := fmt.Sprintf("%s:%s", *ENVS["INTEROP_IP"], *ENVS["INTEROP_PORT"])
	interopChannel := make(chan *ic.Client)
	go ic.EstablishInteropConnection(interopRetryTime, interopURL, *ENVS["INTEROP_USER"], *ENVS["INTEROP_PASS"], interopTimeout, interopChannel)

	// Do other things...
	go mav.RunMavlink(*ENVS["MAV_COMMON_PATH"], *ENVS["MAV_ARDU_PATH"])

	// Once we need to access the interop client
	log.Debug("Waiting for interop connection to be established")
	client := <-interopChannel
	log.Debug("Creating Hub Server")
	var server hs.Server
	server.Run("5000", client)
}
