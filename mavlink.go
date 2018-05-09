package main

import (
	"log"
	"net"
	"time"
	//"fmt"

	"github.com/tritonuas/go-mavlink/mavlink"
	pb "github.com/tritonuas/hub/interop"
	hub "github.com/tritonuas/hub/hub_def"
	
)

func listenAndServe(addr string, telem_topic *hub.Topic) {

	for {
		time.Sleep(time.Millisecond * 500)
		Log.Warning("send telem")
		conn, err := net.Dial("tcp", addr)
		if err != nil {
			continue
		}

		dec := mavlink.NewDecoder(conn)

		dec.Dialects.Add(mavlink.DialectArdupilotmega)

		//enc := mavlink.NewEncoder(conn)

		decodeerrors := 0
		start := time.Now()

		for {
			pkt, err := dec.Decode()

			if decodeerrors > 20 {
				break
			}

			if err != nil {
				decodeerrors += 1
				log.Println("decode error")
				continue
			}

			if (time.Now().Sub(start)) > time.Second {
				decodeerrors = 0
			}

			switch pkt.MsgID {
			case mavlink.MSG_ID_HEARTBEAT:
				var pv mavlink.Heartbeat
				if err := pv.Unpack(pkt); err == nil {
					log.Println("Heartbeat")
				}

			case mavlink.MSG_ID_GLOBAL_POSITION_INT:
				var pv mavlink.GlobalPositionInt
				if err := pv.Unpack(pkt); err == nil {
					log.Println("Position Int")
					lat := float32(pv.Lat)/float32(1e7)
					lon := float32(pv.Lon)/float32(1e7)
					alt := float32(pv.Alt)/float32(1000)
					//rel_alt := float32(pv.RelativeAlt)/float32(1000)
					heading := float32(pv.Hdg)/float32(100)
					telem := &pb.Telemetry{Latitude: lat, Longitude: lon, AltitudeMsl: alt, UasHeading:heading}
					telem_topic.Send(telem)
					log.Println("sent telem")
				}
			case mavlink.MSG_ID_VFR_HUD:
				var vh mavlink.VfrHud
				if err := vh.Unpack(pkt);err==nil {
					log.Println("VFR");
				}		
			case mavlink.MSG_ID_SYS_STATUS:
				var ss mavlink.SysStatus
				if err := ss.Unpack(pkt); err == nil{
					log.Println("SS");
				}
			
			}
		}
	}
}
