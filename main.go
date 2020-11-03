package main

import (
	"flag"

	"github.com/sirupsen/logrus"

	ic "github.com/tritonuas/hub/internal/interopconn"
)

var log = logrus.New()

var interop_ip = flag.String("interop_ip", "127.0.0.1", "IP of interop computer")
var interop_port = flag.String("interop_port", "8000", "Port of interop computer")
var interop_user = flag.String("interop_user", "testuser", "Username on interop computer")
var interop_pass = flag.String("interop_pass", "testpass", "Password to interop computer")
var debug = flag.Bool("debug", false, "Debug Mode Bool")

var url = *interop_ip + ":" + *interop_port


func main() {
	flag.Parse()

	if *debug {
		log.SetLevel(logrus.DebugLevel)
	}

	ic.Log = log
	client := ic.NewClient(url, *interop_user, *interop_pass)
	client.Get("/api/missions/1")
}
