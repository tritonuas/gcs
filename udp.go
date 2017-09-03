package main

import (
	//"github.com/Sirupsen/logrus"
	"net"
	"time"
)

type UDPBackend struct {
	hub                 *Hub
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
			Log.Info("reconnecting")
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

			u.hub.sendStreamMessage(buffer[:n], "plane_obc_data")
		}
	}
}

func createUDPBackend(hub *Hub, port string) *UDPBackend {
	backend := &UDPBackend{hub: hub, port: port}
	return backend
}
