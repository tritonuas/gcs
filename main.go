package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/sirupsen/logrus"

	mav "github.com/tritonuas/hub/internal/mavlink"
	"github.com/tritonuas/hub/internal/mavlink/influxdb"

	// pp "github.com/tritonuas/hub/internal/path_plan"
	"github.com/tritonuas/hub/internal/server"
)

var log = logrus.New()

// Defines globally used variables for ports and IPs and other things.
var ENVS = map[string]*string{
	"HUB_ADDR":             flag.String("hub_addr", "5000", "http service hub_address"),
	"HUB_PATH":             flag.String("hub_path", "/home/mat/gopath/src/github.com/tritonuas/hub", "Path to hub folder"),
	"RTPP_IP":              flag.String("rtpp_ip", "127.0.0.1", "ip of rtpp computer"),
	"RTPP_PORT":            flag.String("rtpp_port", "5010", "port of rtpp computer"),
	"RTPP_TIMEOUT":         flag.String("rtpp_timeout", "360", "time limit in seconds on http requests to interop server"),
	"RTPP_RETRY_TIME":      flag.String("rtpp_retry_time", "5", "how many seconds to wait after unsuccessful rtpp connection"),
	"MAV_DEVICE":           flag.String("mav_device", "serial:/dev/serial", "serial port or tcp address of plane to receive messages from"),
	"MAV_OUTPUT1":          flag.String("mav_output1", "", "first output of mavlink messages"),
	"MAV_OUTPUT2":          flag.String("mav_output2", "", "second output of mavlink messages"),
	"MAV_OUTPUT3":          flag.String("mav_output3", "", "third output of mavlink messages"),
	"MAV_OUTPUT4":          flag.String("mav_output4", "", "fourth output of mavlink messages"),
	"MAV_OUTPUT5":          flag.String("mav_output5", "", "fifth output of mavlink messages"),
	"INFLUXDB_URI":         flag.String("influxdb_uri", "http://influxdb:8086", "uri of inlux database for mavlink messages"),
	"INFLUXDB_TOKEN":       flag.String("influxdb_token", "influxdbToken", "token to allow read/write access to influx database"),
	"INFLUXDB_BUCKET":      flag.String("influxdb_bucket", "mavlink", "bucket for the influx database"),
	"INFLUXDB_ORG":         flag.String("influxdb_org", "TritonUAS", "org for the influx database"),
	"DEBUG_MODE":           flag.String("debug", "False", "Boolean to determine logging mode"),
	"ANTENNA_TRACKER_IP":   flag.String("antenna_tracker_ip", "192.168.1.9", "ip address of antenna tracker arduino"),
	"ANTENNA_TRACKER_PORT": flag.String("antenna_tracker_port", "4000", "port of antenna tracker arduino"),
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
	mav.Log = log
}

// setupEverything calls all the helper functions to set up the loggers,
// environment vars, debug mode...
func setupEverything() {
	setLoggers()
	setEnvVars()
	// prioritize command line flags over environment variables
	flag.Parse()
	if *ENVS["DEBUG_MODE"] == "True" {
		log.SetLevel(logrus.DebugLevel)
		log.Debug("Logging Mode: DEBUG")
	}
}

func main() {
	setupEverything()

	influxCreds := influxdb.Credentials{
		Token:  *ENVS["INFLUXDB_TOKEN"],
		Bucket: *ENVS["INFLUXDB_BUCKET"],
		Org:    *ENVS["INFLUXDB_ORG"],
		URI:    *ENVS["INFLUXDB_URI"],
	}

	influxClient := influxdb.New(influxCreds)

	mavlinkClient := mav.New(
		influxClient,
		*ENVS["ANTENNA_TRACKER_IP"],
		*ENVS["ANTENNA_TRACKER_PORT"],
		*ENVS["MAV_DEVICE"],
		*ENVS["MAV_OUTPUT1"],
		*ENVS["MAV_OUTPUT2"],
		*ENVS["MAV_OUTPUT3"],
		*ENVS["MAV_OUTPUT4"],
		*ENVS["MAV_OUTPUT5"],
	)

	go mavlinkClient.Listen()

	// Set up GIN HTTP Server
	server := server.New(influxClient, mavlinkClient)
	server.Start()
}
