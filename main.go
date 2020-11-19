package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/sirupsen/logrus"
	ic "github.com/tritonuas/hub/internal/interop"
)

var log = logrus.New()
var ENVS = map[string]*string{
	"HUB_ADDR":     flag.String("hub_addr", "5001", "http service hub_address"),
	"HUB_PATH":     flag.String("hub_path", "/home/mat/gopath/src/github.com/tritonuas/hub", "Path to hub folder"),
	"INTEROP_IP":   flag.String("interop_ip", "127.0.0.1", "ip of interop computer"),
	"INTEROP_PORT": flag.String("interop_port", "8000", "port of interop computer"),
	"INTEROP_USER": flag.String("interop_user", "ucsdauvsi", "username on interop computer"),
	"INTEROP_PASS": flag.String("interop_pass", "tritons", "password to interop computer"),
	"MAV_DEVICE":   flag.String("mav_device", ":5761", "mav device"),
	"IP":           flag.String("ip", "*", "ip of interop computer"),
	"SOCKET_ADDR":  flag.String("socket_addr", "127.0.0.1:6667", "ip + port of path planner zmq"),
	"DEBUG_MODE":   flag.String("debug", "False", "Boolean to determine logging mode"),
}

// setEnvVars will check for any hub related environment variables and
// override the initialized values to the environment variables.
func setEnvVars() {
	for _, element := range os.Environ() {
		pair := strings.SplitN(element, "=", 2)
		if _, ok := ENVS[pair[0]]; ok {
			log.Info(fmt.Sprintf("Setting ENVS[%s] = %s", pair[0], pair[1]))
			ENVS[element] = &pair[1]
		}
	}
}

// setLoggers will link together all of the loggers from submodules so
// that all logs go through a central logger.
// Add in other loggers for modules as needed
func setLoggers() {
	ic.Log = log
}

func main() {
	setLoggers()

	// prioritize command line flags over environment variables
	setEnvVars()
	flag.Parse()

	if *ENVS["DEBUG_MODE"] == "True" {
		log.SetLevel(logrus.DebugLevel)
		log.Debug("Logging Mode: DEBUG")
	}

	// create client to interop
	interopURL := fmt.Sprintf("%s:%s", *ENVS["INTEROP_IP"], *ENVS["INTEROP_PORT"])
	client, err := ic.NewClient(interopURL, *ENVS["INTEROP_USER"], *ENVS["INTEROP_PASS"])

	if err.Post {
		log.Warning("Client to Interop failed")
	} else {
		log.Info("Interop Client authenticated correctly.")
	}

	// Testing
	client.Get("/api/missions/1")
}
