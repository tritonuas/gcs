package udp

import (
  "github.com/sirupsen/logrus"
	"net"
	"time"
	hub "github.com/tritonuas/hub/internal/hub_def"
)

var Log = logrus.New()

type UDPBackend struct {
	plane_obc_topic *hub.Topic
	port                string
	lastMessageRecieved time.Time
}

func (u *UDPBackend) Name() string {
	return "planeobc"
}

func (u *UDPBackend) Connected() bool {
	return time.Now().Sub(u.lastMessageRecieved) < (time.Second * 2)
}

func (u *UDPBackend) Run() {
	for {
		/* Lets prepare a address at any address at port 10001*/
		addr, err := net.ResolveUDPAddr("udp", u.port)
		if err != nil {
			Log.Info("Couldn't resolve address")
			continue
		}

		/* Now listen at selected port */
		conn, err := net.ListenUDP("udp", addr)
		if err != nil {
			//Log.Info("reconnecting")
			continue
		}

		// connected
		defer conn.Close()

		for {
			//simple read
			buffer := make([]byte, 4096)

			n, _, err := conn.ReadFromUDP(buffer)
			if err != nil {
				Log.Info("error reading")
				break
			}
			u.lastMessageRecieved = time.Now()
			u.plane_obc_topic.Send(buffer[:n])
		}
	}
}

func CreateUDPBackend(plane_obc_topic *hub.Topic, port string) *UDPBackend {
	backend := &UDPBackend{port: port, plane_obc_topic:plane_obc_topic}
	go backend.Run()
	return backend
}
