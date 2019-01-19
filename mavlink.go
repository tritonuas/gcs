package main

import (
	"net"
	"time"
	//"fmt"

	"github.com/tritonuas/god/go-mavlink/mavlink"
	pb "github.com/tritonuas/god/hub/interop"
	hub "github.com/tritonuas/god/hub/hub_def"
	
)

func metersToFeet(item float32) float32 {
	return float32(3.280839895)*item
}

func listenAndServe(addr string, telem_topic *hub.Topic, loc_topic *hub.Topic, status_topic *hub.Topic) {
	locStatus := pb.PlaneLoc{}
	planeStatus := pb.PlaneStatus{}
	for {
		planeStatus.Connected = false
		time.Sleep(time.Millisecond * 500)
		Log.Warning("send telem")
		conn, err := net.Dial("tcp", addr)
		if err != nil {
			Log.Warning(err)
			continue
		}
		planeStatus.Connected = true
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
				continue
			}

			if (time.Now().Sub(start)) > time.Second {
				decodeerrors = 0
			}

			switch pkt.MsgID {
			case mavlink.MSG_ID_HEARTBEAT:
				var pv mavlink.Heartbeat
				if err := pv.Unpack(pkt); err == nil {
					planeStatus.Armed = (pv.BaseMode & 128) != 0
					if(pv.CustomMode == 0){
						planeStatus.Mode = "MANUAL"
					}
					if(pv.CustomMode == 2){
						planeStatus.Mode = "STABILIZE"
					}
					if(pv.CustomMode == 5){
						planeStatus.Mode = "FBWA"
					}
					if(pv.CustomMode == 10){
						planeStatus.Mode = "AUTO"
					}
					if(pv.CustomMode == 11){
						planeStatus.Mode = "RTL"
					}
					if(pv.SystemStatus == 0){
						planeStatus.SystemStatus = "UNINIT"
					}
					if(pv.SystemStatus == 1){
						planeStatus.SystemStatus = "BOOT"
					}
					if(pv.SystemStatus == 2){
						planeStatus.SystemStatus = "CALIBRATING"
					}
					if(pv.SystemStatus == 3){
						planeStatus.SystemStatus = "STANDBY"
					}
					if(pv.SystemStatus == 4){
						planeStatus.SystemStatus = "ACTIVE"
					}
					if(pv.SystemStatus == 5){
						planeStatus.SystemStatus = "CRITICAL"
					}
					if(pv.SystemStatus == 6){
						planeStatus.SystemStatus = "EMERGENCY"
					}
					if(pv.SystemStatus == 7){
						planeStatus.SystemStatus = "POWEROFF"
					}
					status_topic.Send(&planeStatus)
				}

			case mavlink.MSG_ID_GLOBAL_POSITION_INT:
				var pv mavlink.GlobalPositionInt
				if err := pv.Unpack(pkt); err == nil {
					lat := float32(pv.Lat)/float32(1e7)
					lon := float32(pv.Lon)/float32(1e7)
					alt := metersToFeet(float32(pv.Alt)/float32(1000))
					rel_alt := metersToFeet(float32(pv.RelativeAlt)/float32(1000))
					heading := float32(pv.Hdg)/float32(100)
					locStatus.Lat = lat
					locStatus.Lon = lon
					locStatus.AMsl = alt
					locStatus.ARel = rel_alt
					locStatus.Head = heading
					// USE RELATIVE ALT FOR TESTING ON MISSION REPORT
					telem := &pb.Telemetry{Latitude: lat, Longitude: lon, AltitudeMsl: alt, UasHeading:heading}
					telem_topic.Send(telem)
					loc_topic.Send(&locStatus)
				}
			case mavlink.MSG_ID_VFR_HUD:
				var vh mavlink.VfrHud
				if err := vh.Unpack(pkt);err==nil {
					locStatus.Throttle = float32(vh.Throttle)
					locStatus.Climb = float32(vh.Climb)
					locStatus.Aspeed = float32(vh.Airspeed)
					locStatus.Gspeed = float32(vh.Groundspeed)
					continue
				}		
			case mavlink.MSG_ID_SYS_STATUS:
				var ss mavlink.SysStatus
				if err := ss.Unpack(pkt); err == nil{
					continue
				}
			case mavlink.MSG_ID_MISSION_ITEM_REACHED:
				var mi mavlink.MissionItemReached 
				if err := mi.Unpack(pkt); err == nil{
					planeStatus.CurrentWp = int32(mi.Seq)
				}
			case mavlink.MSG_ID_NAV_CONTROLLER_OUTPUT:
				var mi mavlink.NavControllerOutput 
				if err := mi.Unpack(pkt); err == nil{
					planeStatus.WpDist = metersToFeet(float32(mi.WpDist))
					planeStatus.AltError = metersToFeet(mi.AltError)
					planeStatus.XtrackError = metersToFeet(mi.XtrackError)
					planeStatus.TargetBearing = float32(mi.TargetBearing)
				}
			
			}
		}
	}
}
