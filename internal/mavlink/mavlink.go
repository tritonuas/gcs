package mav

import (
	// "bytes"
	"context"
	"math"

	// "math/rand"

	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	// "sync"
	"time"

	"encoding/xml"
	"io/ioutil"

	ic "github.com/tritonuas/hub/internal/interop"
	pp "github.com/tritonuas/hub/internal/path_plan"

	"github.com/goburrow/serial"

	"github.com/sirupsen/logrus"

	"github.com/aler9/gomavlib"
	// "github.com/aler9/gomavlib/pkg/dialect"
	"github.com/aler9/gomavlib/pkg/dialects/common"
	"github.com/aler9/gomavlib/pkg/msg"

	// "github.com/aler9/gomavlib/pkg/parser"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

//systemID is added to every outgoing frame and used to identify the node that communicates to the plane
//on the network. Shouldn't match any other mavlink device on the network.
const systemID byte = 125

// connRefreshTimer is the number of seconds Hub will wait until attempting to reconnect to the plane
const connRefreshTimer int = 5

//Mavlink structs for mavlink messages from xml files
type Mavlink struct {
	XMLName  xml.Name `xml:"mavlink"`
	Enums    Enums    `xml:"enums"`
	Messages Messages `xml:"messages"`
}

//Enums struct for enums portion of mavlink message xml files
type Enums struct {
	XMLName xml.Name `xml:"enums"`
	Enums   []Enum   `xml:"enum"`
}

//Enum struct for individual enums in mavlink messages
type Enum struct {
	XMLName xml.Name `xml:"enum"`
	Entries []Entry  `xml:"entry"`
	Name    string   `xml:"name,attr"`
}

//Entry struct that holds the cases of each enum type
type Entry struct {
	XMLName xml.Name `xml:"entry"`
	Value   string   `xml:"value,attr"`
	Name    string   `xml:"name,attr"`
}

//Messages struct for messages portion of mavlink message xml files
type Messages struct {
	XMLName  xml.Name  `xml:"messages"`
	Messages []Message `xml:"message"`
}

//Message struct for individual message data
type Message struct {
	XMLName xml.Name `xml:"message"`
	ID      string   `xml:"id,attr"`
	MsgName string   `xml:"name,attr"`
	Fields  []Field  `xml:"field"`
}

//Field Struct for individual fields found in a Message
type Field struct {
	XMLName xml.Name `xml:"field"`
	Name    string   `xml:"name,attr"`
	Enum    string   `xml:"enum,attr"`
}

//Log is the logger for the mavlink interface
var Log = logrus.New()

//parseValues converts the values from a mavlink message in a convenient array of values.
//It takes in a mavlink message and formats the values into an array to
//allow each value to be easily accessible.
func parseValues(message msg.Message) []string {
	str := fmt.Sprintf("%v", message)

	//Removes the outer brackets from mavlink messages
	str = str[2 : len(str)-1]

	return strings.Fields(str)
}

//convertToFloats converts mavlink message values to float values so that InfluxDB can process them.
//It takes in an array of values (in the same format that the function parseValues returns) and
//a message ID number to aid with troubleshooting parsing errors
func convertToFloats(stringValues []string, msgID uint32) []float64 {
	//floatValues creates an empty slice that allocates enough space to hold the values retrieved from a mavlink message
	//The slice is of type float64 because strconv.ParseFloat() returns float64 values. According to the
	//strconv.ParseFloat() documentation: "When bitSize=32, the result still has type float64, but it will be
	//convertible to float32 without changing its value.""
	floatValues := make([]float64, len(stringValues))

	for idx := range stringValues {
		floatVal, err := strconv.ParseFloat(stringValues[idx], 32)
		if err != nil {
			Log.Warn("Mavlink Message with ID", msgID, "is causing a parsing error.")
		}
		floatValues[idx] = floatVal
	}

	return floatValues
}

//getParameterNames retreive mavlink message paramters based on the message ID and type of .xml file to look in
//getParameterNames retrieves the corresponding field names for the values returned by a mavlink message.
//It takes a message ID number so that it can find the field names that belong to that message. It also
//takes a Mavlink struct to determine what type of Mavlink message to look for. Example message types:
//common mavlink (https://mavlink.io/en/messages/common.html), ardupilotmega(https://mavlink.io/en/messages/ardupilotmega.html).
func getParameterNames(msgID uint32, mavlink Mavlink) ([]string, string) {
	var parameterNames []string
	var msgName string

	//TODO: improve this search algorithm
	for i := 0; i < len(mavlink.Messages.Messages); i++ {
		id := mavlink.Messages.Messages[i].ID
		msgName = mavlink.Messages.Messages[i].MsgName
		intID, err := strconv.Atoi(id)
		if err != nil {
			Log.Warn("Mavlink Message with ID", msgID, "is causing a parsing error.")
		}
		if intID == int(msgID) {
			for j := 0; j < len(mavlink.Messages.Messages[i].Fields); j++ {
				parameterNames = append(parameterNames, mavlink.Messages.Messages[i].Fields[j].Name)
			}
			break
		}
	}
	return parameterNames, msgName
}

//getEnumTypeFromField retrives the name of an enum type based on message ID and the index the enum appears in a field
func getEnumTypeFromField(msgID uint32, fieldIndex int, mavlink Mavlink) string {
	for i := 0; i < len(mavlink.Messages.Messages); i++ {
		id := mavlink.Messages.Messages[i].ID
		intID, err := strconv.Atoi(id)
		if err != nil {
			Log.Warn("Mavlink Message with ID", msgID, "is causing a parsing error.")
		}
		if intID == int(msgID) {
			enumType := mavlink.Messages.Messages[i].Fields[fieldIndex].Enum
			return enumType
		}
	}
	return ""
}

//getIntValFromEnum Retrive the integer representation of an enum string representation.
//It takes a message ID number to look for the enum in, the index the enum appears in within the message's
//list of field names, the value of the enum as given by the mavlink message, and a Mavlink struct to determine
//what kind of mavlink message to search for
func getIntValFromEnum(msgID uint32, fieldIndex int, enumVal string, mavlink Mavlink) int {

	enumType := getEnumTypeFromField(msgID, fieldIndex, mavlink)

	for i := 0; i < len(mavlink.Enums.Enums); i++ {
		if mavlink.Enums.Enums[i].Name == enumType {
			for j := 0; j < len(mavlink.Enums.Enums[i].Entries); j++ {
				if mavlink.Enums.Enums[i].Entries[j].Name == enumVal {
					stringValue := mavlink.Enums.Enums[i].Entries[j].Value
					value, err := strconv.Atoi(stringValue)
					if err != nil {
						//invalid enum value
						return -1
					}
					return value
				}
			}
		}
	}
	//returns an invalid enum value
	return -1
}

// Retrieves the type of endpoint based on the address prefix
func getEndpoint(endpointType string, address string) gomavlib.EndpointConf {

	switch endpointType {
	case "serial":
		return gomavlib.EndpointSerial{fmt.Sprintf("%s:57600", address)}

	case "udp":
		return gomavlib.EndpointUDPClient{address}

	case "tcp":
		return gomavlib.EndpointTCPClient{address}

	default:
		return nil
	}
}

//RunMavlink contains the main loop that gathers mavlink messages from the plane and write to an InfluxDB
//mavCommonPath and mavArduPath point to the mavlink message files
func RunMavlink(
	mavCommonPath string,
	mavArduPath string,
	token string,
	bucket string,
	org string,
	mavDevice string,
	influxdbURI string,
	mavOutputs []string,
	telemetryChannel chan *ic.Telemetry,
	sendWaypointToPlaneChannel chan *pp.Path) {

	influxConnDone := false

	var pathReadyForPlane *pp.Path
	var checkForPathAck bool

	// startTime := time.Now()
	// influxCount := 0
	//write the data of a particular message to the local influxDB
	writeToInflux := func(msgID uint32, msgName string, parameters []string, floatValues []float64, writeAPI api.WriteAPI) {
		// if rand.Intn(10) != 0 {
		// 	Log.Error("Get trolled lol ඞ")
		// 	return
		// }
		// if time.Since(startTime) < time.Second*30 {
		// 	influxCount++
		// } else {
		// 	Log.Error("influx push count ", influxCount)
		// }
		// Log.Info("lol ඞ")
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

	//verify connection to the plane according to the type of connection provided
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

	//establishes plane connection
	node, err := gomavlib.NewNode(gomavlib.NodeConf{
		Endpoints: endpoints,
		//ardupilot message dialect
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
	// var nodeMutex sync.Mutex

	defer node.Close()

	Log.Infof("Successfully connected to plane at %s %s", mavDeviceType, mavDeviceAddress)

	//read xml files of messages
	mavXML, err := os.Open(mavCommonPath)
	arduXML, err := os.Open(mavArduPath)
	if err != nil {
		Log.Fatal("Error with opening Mavlink message files")
	}
	defer mavXML.Close()
	defer arduXML.Close()
	mavByteValue, err := ioutil.ReadAll(mavXML)
	arduPilotByteValue, err := ioutil.ReadAll(arduXML)
	if err != nil {
		Log.Fatal("Error with reading Mavlink message files")
	}

	Log.Info("Successfully opened and read mavlink message files")

	var mavlinkCommon Mavlink
	var arduPilotMega Mavlink

	xml.Unmarshal(mavByteValue, &mavlinkCommon)
	xml.Unmarshal(arduPilotByteValue, &arduPilotMega)

	if <-influxConnChan {
		influxConnDone = true
	}

	nh, err := newNodeHandler()
	if err != nil {
		Log.Error(err)
	}
	go nh.run()
	// *gomavlib.Event

	// startYawTime := time.Now()
	// yawCount := 0

	mavRouterParser := func() {
		//loop through incoming events from the plane
		for evt := range node.Events() {
			if rawFrame, ok := evt.(*gomavlib.EventFrame); ok {

				// Forwards mavlink messages to other clients
				nh.onEventFrame(rawFrame)

				// nodeMutex.Lock()
				node.WriteFrameExcept(rawFrame.Channel, rawFrame.Frame)
				// nodeMutex.Unlock()

				/** start of scuffness
				// NOTE: must make dialect nil in the gomavlib nodeconf before enabling this horror
				dialectDE, err := dialect.NewDecEncoder(common.Dialect)
				if err != nil {
					Log.Errorf("Could not create dialect encoder for Mavlink messages. Reason: %s", err)
					continue
				}
				buf := bytes.NewBuffer(nil)
				writer, err := parser.NewWriter(parser.WriterConf{
					Writer:      buf,
					DialectDE:   dialectDE,
					OutVersion:  parser.V2,
					OutSystemID: rawFrame.SystemID(),
				})
				err = writer.WriteFrame(rawFrame.Frame)
				if err != nil {
					Log.Error("could not write frame", err)
					continue
				}

				reader, err := parser.NewReader(parser.ReaderConf{
					Reader:    buf,
					DialectDE: dialectDE,
				})
				if err != nil {
					Log.Errorf("Could not create reader for Mavlink messages. Reason: %s", err)
					continue
				}

				// read a message, encapsulated in a frame
				decodedFrame, err := reader.Read()
				if err != nil {
					Log.Errorf("Could not read Mavlink message frame. Reason: %s", err)
					continue
				}
				end of scuffness **/

				decodedFrame := rawFrame.Frame

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
					Log.Info("Type: %v, MissionType: %v", msg.Type, msg.MissionType)
					// **/
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
						Frame:           common.MAV_FRAME_GLOBAL_RELATIVE_ALT,                        // global frame allows us to give global coordinates (lat/lon in degrees for example)
						Command:         common.MAV_CMD_NAV_WAYPOINT,                                 // type of command (we want to send waypoints)
						Current:         uint8(cur),                                                  // if it's the current waypoint or not?
						Autocontinue:    0,                                                           // always 0
						Param1:          0,                                                           // Hold Time: ignored by fixed wing planes
						Param2:          0,                                                           // Accept Radius (radial threshold in meters for a waypoint to be hit)
						Param3:          0,                                                           // Pass Radius (idk what this is exactly yet)
						Param4:          float32(math.NaN()),                                         // Yaw to enter waypoint at
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
						Frame:           common.MAV_FRAME_GLOBAL_RELATIVE_ALT,                        // global frame allows us to give global coordinates (lat/lon in degrees for example)
						Command:         common.MAV_CMD_NAV_WAYPOINT,                                 // type of command (we want to send waypoints)
						Current:         uint8(cur),                                                  // if it's the current waypoint or not?
						Autocontinue:    0,                                                           // always 0
						Param1:          0,                                                           // Hold Time: ignored by fixed wing planes
						Param2:          0,                                                           // Accept Radius (radial threshold in meters for a waypoint to be hit)
						Param3:          0,                                                           // Pass Radius (idk what this is exactly yet)
						Param4:          float32(math.NaN()),                                         // Yaw to enter waypoint at
						X:               int32(pathReadyForPlane.Waypoints[msg.Seq].Latitude * 1e7),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
						Y:               int32(pathReadyForPlane.Waypoints[msg.Seq].Longitude * 1e7), // Longitude of waypoint (accepts an int which is the latitude * 10^7)
						Z:               float32(pathReadyForPlane.Waypoints[msg.Seq].Altitude),      // altitude in meters over mean sea level (MSL)
						MissionType:     common.MAV_MISSION_TYPE_MISSION,
					})
					if int(msg.Seq) == len(pathReadyForPlane.Waypoints)-1 {
						checkForPathAck = true
					}
				}

				// old waypoint sending
				/**
				// deprecated MissionRequest message (SITL still uses bruh)
				if msg, ok := decodedFrame.GetMessage().(*common.MessageMissionRequest); ok {
					if wpsReadyForPlane == nil {
						Log.Error("Waypoints not received from Path Planning server yet")
						break
					}
					if int(msg.Seq) > len(wpsReadyForPlane)-1 {
						Log.Error("Waypoints stored on hub don't match the ones the plane is requesting. Try to initialize them again.")
						break
					}
					cur := 0
					if int(msg.Seq) == 0 {
						cur = 1
					}
					Log.Infof("Sending waypoint %v", msg.Seq)
					node.WriteMessageAll(&common.MessageMissionItem{
						TargetSystem:    1, // SystemID of the plane
						TargetComponent: 0, // ComponentID
						Seq:             msg.Seq,
						Frame:           common.MAV_FRAME_GLOBAL,                      // global frame allows us to give global coordinates (lat/lon in degrees for example)
						Command:         common.MAV_CMD_NAV_WAYPOINT,                  // type of command (we want to send waypoints)
						Current:         uint8(cur),                                   // if it's the current waypoint or not?
						Autocontinue:    0,                                            // always 0
						Param1:          0,                                            // Hold Time: ignored by fixed wing planes
						Param2:          0,                                            // Accept Radius (radial threshold in meters for a waypoint to be hit)
						Param3:          0,                                            // Pass Radius (idk what this is exactly yet)
						Param4:          float32(math.NaN()),                          // Yaw to enter waypoint at
						X:               float32(wpsReadyForPlane[msg.Seq].Latitude),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
						Y:               float32(wpsReadyForPlane[msg.Seq].Longitude), // Longitude of waypoint (accepts an int which is the latitude * 10^7)
						Z:               float32(wpsReadyForPlane[msg.Seq].Altitude),  // altitude in meters over mean sea level (MSL)
						MissionType:     common.MAV_MISSION_TYPE_MISSION,
					})
				}

				if msg, ok := decodedFrame.GetMessage().(*common.MessageMissionAck); ok {
					Log.Error(msg)
					Log.Error(msg.Type)
				}

				// newer MissionRequestInt message
				if msg, ok := decodedFrame.GetMessage().(*common.MessageMissionRequestInt); ok {
					if wpsReadyForPlane == nil {
						Log.Error("Waypoints not received from Path Planning server yet")
						break
					}
					if int(msg.Seq) > len(wpsReadyForPlane)-1 {
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
						Frame:           common.MAV_FRAME_GLOBAL,                          // global frame allows us to give global coordinates (lat/lon in degrees for example)
						Command:         common.MAV_CMD_NAV_WAYPOINT,                      // type of command (we want to send waypoints)
						Current:         uint8(cur),                                       // if it's the current waypoint or not?
						Autocontinue:    0,                                                // always 0
						Param1:          0,                                                // Hold Time: ignored by fixed wing planes
						Param2:          0,                                                // Accept Radius (radial threshold in meters for a waypoint to be hit)
						Param3:          0,                                                // Pass Radius (idk what this is exactly yet)
						Param4:          float32(math.NaN()),                              // Yaw to enter waypoint at
						X:               int32(wpsReadyForPlane[msg.Seq].Latitude * 1e7),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
						Y:               int32(wpsReadyForPlane[msg.Seq].Longitude * 1e7), // Longitude of waypoint (accepts an int which is the latitude * 10^7)
						Z:               float32(wpsReadyForPlane[msg.Seq].Altitude),      // altitude in meters over mean sea level (MSL)
						MissionType:     common.MAV_MISSION_TYPE_MISSION,
					})
				}
				**/

				// old parsing for a bunch more messages
				/**
				msgID := decodedFrame.GetMessage().GetID()

				//gather the raw values returned by the plane as an array of strings
				rawValues := parseValues(decodedFrame.GetMessage())

				//common mavlink message IDs with no arrays or enums
				// normalMessageIDS := []int{1, 27, 29, 30, 32, 33, 35, 36, 42, 46, 62, 65, 74, 116, 125, 136, 241}
				normalMessageIDS := []int{27, 29, 30, 32, 33, 35, 36, 42, 46, 62, 65, 74, 116, 136, 241}
				for _, normalMessageID := range normalMessageIDS {
					if int(msgID) == normalMessageID {
						floatValues := convertToFloats(rawValues, msgID)
						parameters, msgName := getParameterNames(msgID, mavlinkCommon)

						// 33:
						// https://mavlink.io/en/messages/common.html
						// TODO: move this info to the wiki
						// 0: time_boot_ms
						// 1: lat (DIVIDE BY 10^6) Note: mavlink documentation says 10e7 but this isn't the correct value??
						// 2: lon (DIVIDE BY 10^6)
						// 3: alt (DIVIDE BY 1000)
						// 4: relative_alt (DIVIDE BY 1000) (USE THIS ONE)
						// 5: vx
						// 6: vy
						// 7: vz
						// 8: hdg (heading) (CENTIDEGREES DIVIDE BY 100)
						if msgID == 33 {
							lat := floatValues[1] / 10e6
							lon := floatValues[2] / 10e6
							relative_alt := floatValues[4] / 1000
							hdg := floatValues[8] / 100
							telem := ic.Telemetry{Latitude: &lat, Longitude: &lon, Altitude: &relative_alt, Heading: &hdg}
							telemetryChannel <- &telem
						}

						if msgID == 30 {
							yawCount++
						}
						if yawCount > 100 {
							duration := time.Since(startYawTime)
							Log.Fatal("Took", duration, "to get 100 yaws")
						}

						writeToInflux(msgID, msgName, parameters, floatValues, writeAPI)
						break
					}
				}

				//ardupilot dialect message IDs found in ardupilotmega.xml
				// arduPilotMessageIDS := []int{150, 152, 163, 164, 165, 168, 174, 178, 182, 193}
				// for _, ardupilotMessageID := range arduPilotMessageIDS {
				// 	if int(msgID) == ardupilotMessageID {
				// 		floatValues := convertToFloats(rawValues, msgID)
				// 		parameters, msgName := getParameterNames(msgID, arduPilotMega)
				// 		writeToInflux(msgID, msgName, parameters, floatValues, writeAPI)
				// 		break
				// 	}
				// }

				switch msgID {

				//Messages below don't work with all floats and require custom parsing

				//PARAM_VALUE
				case 22:
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					//enum parser
					paramType := float64(getIntValFromEnum(msgID, 2, rawValues[2], mavlinkCommon))
					enumVals := []float64{paramType}
					var enumNames []string
					enumNames = append(enumNames, parameters[2:3]...)
					writeToInflux(msgID, msgName, enumNames, enumVals, writeAPI)

					//remaining float parsing
					floatValues := convertToFloats(rawValues[1:2], msgID)
					floatValues = append(floatValues, convertToFloats(rawValues[3:], msgID)...)
					floatParameters := parameters[1:2]
					floatParameters = append(floatParameters, parameters[3:]...)
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

				//GPS_RAW_INT
				case 24:
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					//enum parser
					fixType := float64(getIntValFromEnum(msgID, 1, rawValues[1], mavlinkCommon))
					enumVals := []float64{fixType}
					enumNames := []string{parameters[1]}
					writeToInflux(msgID, msgName, enumNames, enumVals, writeAPI)

					//remaining float parser
					floatValues := convertToFloats(rawValues[0:1], msgID)
					floatValues = append(floatValues, convertToFloats(rawValues[2:], msgID)...)
					floatParameters := parameters[0:1]
					floatParameters = append(floatParameters, parameters[2:]...)
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

				//MISSION_REQUEST
				// case 40:
				// 	parameters, msgName := getParameterNames(msgID, mavlinkCommon)

				// 	//enum parser
				// 	missionType := float64(getIntValFromEnum(msgID, 3, rawValues[3], mavlinkCommon))
				// 	enumVals := []float64{missionType}
				// 	enumNames := []string{parameters[3]}
				// 	writeToInflux(msgID, msgName, enumNames, enumVals, writeAPI)

				//COMMAND_ACK
				case 77:
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					//enum parser
					command := float64(getIntValFromEnum(msgID, 0, rawValues[0], mavlinkCommon))
					result := float64(getIntValFromEnum(msgID, 1, rawValues[1], mavlinkCommon))
					enumVals := []float64{command, result}
					var enumNames []string
					enumNames = append(enumNames, parameters[0:2]...)
					writeToInflux(msgID, msgName, enumNames, enumVals, writeAPI)

					//parses remaining floats
					floatValues := convertToFloats(rawValues[2:], msgID)
					floatParameters := parameters[2:]
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

				//POSITION_TARGET_GLOBAL_INT
				case 87:
					//two enum values
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					//enum parse and write
					coordinateFrame := float64(getIntValFromEnum(msgID, 1, rawValues[1], mavlinkCommon))
					typeMask := float64(getIntValFromEnum(msgID, 2, rawValues[2], mavlinkCommon))
					enumVals := []float64{coordinateFrame, typeMask}
					var enumNames []string
					enumNames = append(enumNames, parameters[1:3]...)
					writeToInflux(msgID, msgName, enumNames, enumVals, writeAPI)

					floatValues := convertToFloats(rawValues[0:1], msgID)
					floatValues = append(floatValues, convertToFloats(rawValues[3:], msgID)...)
					floatParameters := parameters[0:1]
					floatParameters = append(floatParameters, parameters[3:]...)
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

				//BATTERY_STATUS
				case 147:
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					//parses array of battery voltage information for cells 1 to 10
					voltageStrings := rawValues[4:14]
					for i := 0; i < len(voltageStrings); i++ {
						label := fmt.Sprintf("voltages%v", i)
						if i == 0 {
							voltageStrings[i] = (voltageStrings[i])[1:]
						} else if i == len(voltageStrings)-1 {
							voltageStrings[i] = (voltageStrings[i])[:len(voltageStrings[i])-1]
						}
						value, err := strconv.ParseFloat(voltageStrings[i], 32)
						if err != nil {
							break
						}
						p := influxdb2.NewPointWithMeasurement(msgName).
							AddTag("ID", fmt.Sprintf("%v", msgID)).
							AddField(label, value).
							SetTime(time.Now())
						writeAPI.WritePoint(p)
					}

					//parses array of battery voltage information for cells 11 to 14
					voltageExtStrings := rawValues[20:24]
					for i := 0; i < len(voltageExtStrings); i++ {
						label := fmt.Sprintf("voltages_ext%v", i)
						if i == 0 {
							voltageExtStrings[i] = (voltageExtStrings[i])[1:]
						} else if i == len(voltageExtStrings)-1 {
							voltageExtStrings[i] = (voltageExtStrings[i])[:len(voltageExtStrings[i])-1]
						}
						value, err := strconv.ParseFloat(voltageExtStrings[i], 32)
						if err != nil {
							break
						}
						p := influxdb2.NewPointWithMeasurement(msgName).
							AddTag("ID", fmt.Sprintf("%v", msgID)).
							AddField(label, value).
							SetTime(time.Now())
						writeAPI.WritePoint(p)
					}

					//parse the remaining enum values
					batteryFunction := float64(getIntValFromEnum(msgID, 1, rawValues[1], mavlinkCommon))
					batteryType := float64(getIntValFromEnum(msgID, 2, rawValues[2], mavlinkCommon))
					chargingState := float64(getIntValFromEnum(msgID, 10, rawValues[19], mavlinkCommon))
					batteryMode := float64(getIntValFromEnum(msgID, 12, rawValues[24], mavlinkCommon))
					faultBitmask := float64(getIntValFromEnum(msgID, 13, rawValues[25], mavlinkCommon))
					enumVals := []float64{batteryFunction, batteryType, chargingState, batteryMode, faultBitmask}
					var enumNames []string
					enumNames = append(enumNames, parameters[1:3]...)
					enumNames = append(enumNames, parameters[10:11]...)
					enumNames = append(enumNames, parameters[12:]...)
					writeToInflux(msgID, msgName, enumNames, enumVals, writeAPI)

					//parse the rest of the values normally
					floatValues := convertToFloats(rawValues[0:1], msgID)
					floatValues = append(floatValues, convertToFloats(rawValues[3:4], msgID)...)
					floatValues = append(floatValues, convertToFloats(rawValues[14:19], msgID)...)
					floatParameters := parameters[0:1]
					floatParameters = append(floatParameters, parameters[3:4]...)
					floatParameters = append(floatParameters, parameters[5:10]...)
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

					writeAPI.Flush()

				//HOME_POSITION
				case 242:
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					//one array
					floatValues := convertToFloats(rawValues[0:6], msgID)
					floatValues = append(floatValues, convertToFloats(rawValues[10:], msgID)...)
					floatParameters := parameters[0:6]
					floatParameters = append(floatParameters, parameters[7:]...)
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

				// STATUSTEXT
				case 253:
					parameters, msgName := getParameterNames(msgID, mavlinkCommon)

					floatValues := convertToFloats(rawValues[len(rawValues)-2:], msgID)
					floatParameters := parameters[len(parameters)-2:]
					writeToInflux(msgID, msgName, floatParameters, floatValues, writeAPI)

				case 47:
					Log.Error("Plane sent ack", decodedFrame.GetMessage())

					// case 51:
					// 	fallthrough
					// case 40:
					// 	if msg, ok := decodedFrame.GetMessage().(*common.MessageMissionRequest); ok {
					// 		if wpsReadyForPlane == nil {
					// 			Log.Error("Waypoints not received from Path Planning server yet")
					// 			break
					// 		}
					// 		if int(msg.Seq) > len(wpsReadyForPlane)-1 {
					// 			Log.Error("Waypoints stored on hub don't match the ones the plane is requesting. Try to initialize them again.")
					// 			break
					// 		}
					// 		cur := 0
					// 		if int(msg.Seq) == 0 {
					// 			cur = 1
					// 		}
					// 		node.WriteMessageAll(&common.MessageMissionItem{
					// 			TargetSystem:    1, // SystemID of the plane
					// 			TargetComponent: 0, // ComponentID
					// 			Seq:             msg.Seq,
					// 			Frame:           common.MAV_FRAME_GLOBAL,                      // global frame allows us to give global coordinates (lat/lon in degrees for example)
					// 			Command:         common.MAV_CMD_NAV_WAYPOINT,                  // type of command (we want to send waypoints)
					// 			Current:         uint8(cur),                                   // if it's the current waypoint or not?
					// 			Autocontinue:    0,                                            // always 0
					// 			Param1:          0,                                            // Hold Time: ignored by fixed wing planes
					// 			Param2:          0,                                            // Accept Radius (radial threshold in meters for a waypoint to be hit)
					// 			Param3:          0,                                            // Pass Radius (idk what this is exactly yet)
					// 			Param4:          float32(math.NaN()),                          // Yaw to enter waypoint at
					// 			X:               float32(wpsReadyForPlane[msg.Seq].Latitude),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
					// 			Y:               float32(wpsReadyForPlane[msg.Seq].Longitude), // Longitude of waypoint (accepts an int which is the latitude * 10^7)
					// 			Z:               float32(wpsReadyForPlane[msg.Seq].Altitude),  // altitude in meters over mean sea level (MSL)
					// 			MissionType:     common.MAV_MISSION_TYPE_MISSION,
					// 		})
					// 	}
				}
				**/
			}
		}
	}

	go mavRouterParser()

	defer client.Close()

	for {
		pathFromPP := <-sendWaypointToPlaneChannel
		Log.Info("Received waypoints from PP and letting plane know")
		// nodeMutex.Lock()
		node.WriteMessageAll(&common.MessageMissionClearAll{
			TargetSystem:    1,
			TargetComponent: 0,
			MissionType:     0,
		})
		// let the plane know that we want to upload a given number of messages
		node.WriteMessageAll(&common.MessageMissionCount{
			TargetSystem:    1,
			TargetComponent: 0,
			Count:           uint16(len(pathFromPP.Waypoints)),
			MissionType:     common.MAV_MISSION_TYPE_MISSION,
		})
		// nodeMutex.Unlock()
		//pathReadyForPlane = make([]pp.Waypoint, len(pathFromPP.Waypoints))
		pathReadyForPlane = pathFromPP
	}

}
