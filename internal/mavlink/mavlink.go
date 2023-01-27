package mav

import (
	"context"

	"fmt"
	"net"
	"strings"

	"time"

	"github.com/tritonuas/hub/internal/obc/pp"

	"github.com/goburrow/serial"

	"github.com/sirupsen/logrus"

	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/common"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

// systemID is added to every outgoing frame and used to identify the node that communicates to the plane
// on the network. Shouldn't match any other mavlink device on the network.
const systemID byte = 125

// connRefreshTimer is the number of seconds Hub will wait until attempting to reconnect to the plane
const connRefreshTimer int = 5

// Log is the logger for the mavlink interface
var Log = logrus.New()

// Retrieves the type of endpoint based on the address prefix
func getEndpoint(endpointType string, address string) gomavlib.EndpointConf {

	switch endpointType {
	case "serial":
		return gomavlib.EndpointSerial{Address: fmt.Sprintf("%s:57600", address)}

	case "udp":
		return gomavlib.EndpointUDPClient{Address: address}

	case "tcp":
		return gomavlib.EndpointTCPClient{Address: address}

	default:
		return nil
	}
}

// RunMavlink contains the main loop that gathers mavlink messages from the plane and write to an InfluxDB
// mavCommonPath and mavArduPath point to the mavlink message files
// nolint: gocyclo
func RunMavlink(
	token string,
	bucket string,
	org string,
	mavDevice string,
	influxdbURI string,
	mavOutputs []string,
) {

	influxConnDone := false

	var pathReadyForPlane *pp.Path
	var checkForPathAck bool

	// startTime := time.Now()
	// influxCount := 0
	// write the data of a particular message to the local influxDB
	writeToInflux := func(msgID uint32, msgName string, parameters []string, floatValues []float64, writeAPI api.WriteAPI) {
		if !influxConnDone {
			return
		}
		for idx := range parameters {
			p := influxdb2.NewPointWithMeasurement(msgName).
				AddTag("ID", fmt.Sprintf("%v", msgID)).
				AddField(parameters[idx], floatValues[idx]).
				SetTime(time.Now())
			writeAPI.WritePoint(p)
		}
		writeAPI.Flush()
	}

	mavDeviceSplit := strings.Split(mavDevice, ":")

	// Stores the type of device where information will be read from (udp, tcp, or serial connection)
	mavDeviceType := mavDeviceSplit[0]
	mavDeviceAddress := strings.Join(mavDeviceSplit[1:], ":")

	// verify connection to the plane according to the type of connection provided
	switch mavDeviceType {
	case "serial":
		for {
			_, err := serial.Open(&serial.Config{Address: mavDeviceAddress})
			if err == nil {
				break
			}
			Log.Warn(fmt.Sprintf("Connection to plane failed at serial port %s. Trying to establish connection again in %d seconds...", mavDeviceAddress, connRefreshTimer))
			time.Sleep(time.Duration(connRefreshTimer) * time.Second)
		}
	case "tcp":
		fallthrough
	case "udp":
		for {
			_, err := net.Dial(mavDeviceType, mavDeviceAddress)
			if err == nil {
				break
			}
			Log.Warn(fmt.Sprintf("Connection to plane failed at %s:%s. Trying to establish connection again in %d seconds...", mavDeviceType, mavDeviceAddress, connRefreshTimer))
			time.Sleep(time.Duration(connRefreshTimer) * time.Second)
		}

	default:
		Log.Fatal("Invalid Mavlink device connection type. Change the connection type to upp, tcp, or serial")
	}

	endpoints := []gomavlib.EndpointConf{}
	mavs := []string{mavDevice}
	mavs = append(mavs, mavOutputs...)

	for _, mavOutput := range mavs {
		if mavOutput == "" {
			continue
		}
		mavOutputSplit := strings.Split(mavOutput, ":")
		mavOutputAddress := ""
		for i := 1; i < len(mavOutputSplit); i++ {
			mavOutputAddress += mavOutputSplit[i]
			if i != len(mavOutputSplit)-1 {
				mavOutputAddress += ":"
			}
		}
		endpoint := getEndpoint(mavOutputSplit[0], mavOutputAddress)
		if endpoint != nil {
			endpoints = append(endpoints, endpoint)
		}
	}

	client := influxdb2.NewClient(influxdbURI, token)
	writeAPI := client.WriteAPI(org, bucket)

	// make a test query to check influx connection status before attempting to write any data
	queryAPI := client.QueryAPI(org)

	influxCheck := func(influxConnChan chan bool) {
		for {
			_, err := queryAPI.Query(context.Background(), fmt.Sprintf(`from(bucket:"%s")|> range(start: -1h) |> filter(fn: (r) => r._measurement == "33")`, bucket))
			if err == nil {
				influxConnChan <- true
				Log.Infof("Successfully connected to InfluxDB at %s.", influxdbURI)
				break
			}
			Log.Errorf("Connection to InfluxDB failed. Trying again in %d seconds.", connRefreshTimer)
			time.Sleep(time.Duration(connRefreshTimer) * time.Second)
		}
	}
	influxConnChan := make(chan bool)
	go influxCheck(influxConnChan)

	// establishes plane connection
	node, err := gomavlib.NewNode(gomavlib.NodeConf{
		Endpoints: endpoints,
		// ardupilot message dialect
		Dialect: common.Dialect,
		// Dialect:        nil,
		OutVersion:     gomavlib.V2,
		OutSystemID:    systemID,
		OutComponentID: 2,
		// HeartbeatDisable:       false,
		// HeartbeatPeriod:        time.Duration(5) * time.Second,
		StreamRequestEnable: true,
		// StreamRequestFrequency: 4,
	})
	if err != nil {
		Log.Warn(err)
	}

	defer node.Close()

	Log.Infof("Successfully connected to plane at %s %s", mavDeviceType, mavDeviceAddress)

	if <-influxConnChan {
		influxConnDone = true
	}

	nh, err := newNodeHandler()
	if err != nil {
		Log.Error(err)
	}
	go nh.run()

	mavRouterParser := func() {
		// loop through incoming events from the plane
		for e := range node.Events() {
			switch evt := e.(type) {
			case *gomavlib.EventChannelOpen:
				Log.Infof("Mavlink channel opened: %s", evt.Channel)
			case *gomavlib.EventChannelClose:
				Log.Infof("Mavlink channel closed: %s", evt.Channel)
				nh.onEventChannelClose(evt)
			case *gomavlib.EventFrame:
				// Forwards mavlink messages to other clients
				nh.onEventFrame(evt)

				node.WriteFrameExcept(rawFrame.Channel, rawFrame.Frame)


				decodedFrame := evt.Frame

				// testing new parsing
				switch msg := decodedFrame.GetMessage().(type) {

				// /**
				case *common.MessageGlobalPositionInt:
					fields := []string{"alt", "lat", "lon", "relative_alt", "vx", "vy", "hdg"}
					vals := []float64{float64(msg.Alt), float64(msg.Lat), float64(msg.Lon), float64(msg.RelativeAlt), float64(msg.Vx), float64(msg.Vy), float64(msg.Hdg)}
					writeToInflux(msg.GetID(), "GLOBAL_POSITION_INT", fields, vals, writeAPI)
				case *common.MessageAttitude:
					fields := []string{"pitch", "pitchspeed", "roll", "rollspeed", "yaw", "yawspeed"}
					vals := []float64{float64(msg.Pitch), float64(msg.Pitchspeed), float64(msg.Roll), float64(msg.Rollspeed), float64(msg.Yaw), float64(msg.Yawspeed)}
					writeToInflux(msg.GetID(), "ATTITUDE", fields, vals, writeAPI)
				case *common.MessageVfrHud:
					fields := []string{"airspeed", "alt", "climb", "groundspeed", "heading", "throttle"}
					vals := []float64{float64(msg.Airspeed), float64(msg.Alt), float64(msg.Climb), float64(msg.Groundspeed), float64(msg.Heading), float64(msg.Throttle)}
					writeToInflux(msg.GetID(), "VFR_HUD", fields, vals, writeAPI)
				case *common.MessageMissionAck:
					if msg.Type == common.MAV_MISSION_ACCEPTED && pathReadyForPlane != nil && checkForPathAck {
						pathReadyForPlane.PlaneAcknowledged = true
					}
					checkForPathAck = false
					Log.Info("Received acknowledgement from team", msg)
					Log.Infof("Type: %v, MissionType: %v", msg.Type, msg.MissionType)
				case *common.MessageMissionRequest:
					Log.Debug("Plane requested deprecated MISSON_REQUEST instead of MISSION_REQUEST_INT")
					if pathReadyForPlane == nil {
						Log.Error("Waypoints not received from Path Planning server yet")
						break
					}
					if int(msg.Seq) > len(pathReadyForPlane.Waypoints)-1 {
						Log.Error("Waypoints stored on hub don't match the ones the plane is requesting. Try to initialize them again.")
						break
					}
					cur := 0
					if int(msg.Seq) == 0 {
						cur = 1
					}
					Log.Infof("Sending waypoint %v", msg.Seq)
					node.WriteMessageAll(&common.MessageMissionItemInt{
						TargetSystem:    1, // SystemID of the plane
						TargetComponent: 0, // ComponentID
						Seq:             msg.Seq,
						Frame:           common.MAV_FRAME_GLOBAL,                                     // global frame allows us to give global coordinates (lat/lon in degrees for example)
						Command:         common.MAV_CMD_NAV_WAYPOINT,                                 // type of command (we want to send waypoints)
						Current:         uint8(cur),                                                  // if it's the current waypoint or not?
						Autocontinue:    0,                                                           // always 0
						Param1:          0,                                                           // Hold Time: ignored by fixed wing planes
						Param2:          float32(pathReadyForPlane.Waypoints[msg.Seq].AcceptRadius),  // Accept Radius (radial threshold in meters for a waypoint to be hit)
						Param3:          0,                                                           // Pass Radius (idk what this is exactly yet)
						Param4:          float32(pathReadyForPlane.Waypoints[msg.Seq].Heading),       // Yaw to enter waypoint at
						X:               int32(pathReadyForPlane.Waypoints[msg.Seq].Latitude * 1e7),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
						Y:               int32(pathReadyForPlane.Waypoints[msg.Seq].Longitude * 1e7), // Longitude of waypoint (accepts an int which is the latitude * 10^7)
						Z:               float32(pathReadyForPlane.Waypoints[msg.Seq].Altitude),      // altitude in meters over mean sea level (MSL)
						MissionType:     common.MAV_MISSION_TYPE_MISSION,
					})
					if int(msg.Seq) == len(pathReadyForPlane.Waypoints)-1 {
						checkForPathAck = true
					}
				case *common.MessageMissionRequestInt:
					if pathReadyForPlane == nil {
						Log.Error("Waypoints not received from Path Planning server yet")
						break
					}
					if int(msg.Seq) > len(pathReadyForPlane.Waypoints)-1 {
						Log.Error("Waypoints stored on hub don't match the ones the plane is requesting. Try to initialize them again.")
						break
					}
					cur := 0
					if int(msg.Seq) == 0 {
						cur = 1
					}
					Log.Infof("Sending waypoint %v", msg.Seq)
					node.WriteMessageAll(&common.MessageMissionItemInt{
						TargetSystem:    1, // SystemID of the plane
						TargetComponent: 0, // ComponentID
						Seq:             msg.Seq,
						Frame:           common.MAV_FRAME_GLOBAL,                                     // global frame allows us to give global coordinates (lat/lon in degrees for example)
						Command:         common.MAV_CMD_NAV_WAYPOINT,                                 // type of command (we want to send waypoints)
						Current:         uint8(cur),                                                  // if it's the current waypoint or not?
						Autocontinue:    0,                                                           // always 0
						Param1:          0,                                                           // Hold Time: ignored by fixed wing planes
						Param2:          float32(pathReadyForPlane.Waypoints[msg.Seq].AcceptRadius),  // Accept Radius (radial threshold in meters for a waypoint to be hit)
						Param3:          0,                                                           // Pass Radius (idk what this is exactly yet)
						Param4:          float32(pathReadyForPlane.Waypoints[msg.Seq].Heading),       // Yaw to enter waypoint at
						X:               int32(pathReadyForPlane.Waypoints[msg.Seq].Latitude * 1e7),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
						Y:               int32(pathReadyForPlane.Waypoints[msg.Seq].Longitude * 1e7), // Longitude of waypoint (accepts an int which is the latitude * 10^7)
						Z:               float32(pathReadyForPlane.Waypoints[msg.Seq].Altitude),      // altitude in meters over mean sea level (MSL)
						MissionType:     common.MAV_MISSION_TYPE_MISSION,
					})
					if int(msg.Seq) == len(pathReadyForPlane.Waypoints)-1 {
						checkForPathAck = true
					}
				}

			}
		}
	}

	defer client.Close()
	mavRouterParser()

	// NOTE: this was commented out until we find a better way to do this instead of sending the entire path over a channel
	// for {
	// pathFromPP := <-sendWaypointToPlaneChannel
	// Log.Info("Received waypoints from PP and letting plane know")
	// // nodeMutex.Lock()
	// node.WriteMessageAll(&common.MessageMissionClearAll{
	// 	TargetSystem:    1,
	// 	TargetComponent: 0,
	// 	MissionType:     0,
	// })
	// // let the plane know that we want to upload a given number of messages
	// node.WriteMessageAll(&common.MessageMissionCount{
	// 	TargetSystem:    1,
	// 	TargetComponent: 0,
	// 	Count:           uint16(len(pathFromPP.Waypoints)),
	// 	MissionType:     common.MAV_MISSION_TYPE_MISSION,
	// })
	// // nodeMutex.Unlock()
	// //pathReadyForPlane = make([]pp.Waypoint, len(pathFromPP.Waypoints))
	// pathReadyForPlane = pathFromPP
	// }

}
