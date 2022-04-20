package mav

import (
	// "context"

	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	"sync"
	"time"

	"encoding/xml"
	"io/ioutil"

	ic "github.com/tritonuas/hub/internal/interop"
	pp "github.com/tritonuas/hub/internal/path_plan"

	"github.com/goburrow/serial"

	"github.com/sirupsen/logrus"

	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/ardupilotmega"
	"github.com/aler9/gomavlib/pkg/dialects/common"
	"github.com/aler9/gomavlib/pkg/msg"
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
	sendWaypointToPlaneChannel chan []pp.Waypoint) {

	influxConnDone := false

	waitingToSendWaypoints := false

	//write the data of a particular message to the local influxDB
	_ = func(msgID uint32, msgName string, parameters []string, floatValues []float64, writeAPI api.WriteAPI) {
		return
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
	_ = client.WriteAPI(org, bucket)

	// make a test query to check influx connection status before attempting to write any data
	/*
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
	*/

	//establishes plane connection
	// msgs := []msg.Message{&common.MessageHeartbeat{}, &common.MessageRequestDataStream{}}
	// dialect := &dialect.Dialect{3, msgs}
	node, err := gomavlib.NewNode(gomavlib.NodeConf{
		Endpoints: endpoints,
		//ardupilot message dialect
		Dialect:                common.Dialect,
		OutVersion:             gomavlib.V2,
		OutSystemID:            systemID,
		OutComponentID:         190,
		HeartbeatDisable:       false,
		HeartbeatPeriod:        time.Duration(5) * time.Second,
		StreamRequestEnable:    true,
		StreamRequestFrequency: 4,
	})
	if err != nil {
		Log.Warn(err)
	}
	var nodeMutex sync.Mutex

	defer node.Close()

	Log.Infof("Successfully connected to plane at %s %s", mavDeviceType, mavDeviceAddress)

	// test := func() {
	// 	for {
	// 		err = SendWaypointToDevice("tcp:localhost:5760", 0.0, 2.0, -1.0, 40.0)
	// 		if err != nil {
	// 			Log.Fatal(err)
	// 		}
	// 		Log.Error("Sent message")
	// 		time.Sleep(time.Duration(1) * time.Second)
	// 		break
	// 	}
	// }
	// go test()

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

	/*
		if <-influxConnChan {
			influxConnDone = true
		}
	*/

	nh, err := newNodeHandler()
	if err != nil {
		Log.Error(err)
	}
	go nh.run()

	mavRouterParser := func() {
		//loop through incoming events from the plane
		for evt := range node.Events() {
			if frm, ok := evt.(*gomavlib.EventFrame); ok {

				// Forwards mavlink messages to other clients
				nh.onEventFrame(frm)

				nodeMutex.Lock()
				node.WriteFrameExcept(frm.Channel, frm.Frame)
				nodeMutex.Unlock()

				msgID := frm.Message().GetID()

				//gather the raw values returned by the plane as an array of strings
				rawValues := parseValues(frm.Message())

				/**
				//common mavlink message IDs with no arrays or enums
				normalMessageIDS := []int{1, 27, 29, 30, 32, 33, 35, 36, 42, 46, 62, 65, 74, 116, 125, 136, 241}
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
				**/

				switch msgID {

				//Messages below don't work with all floats and require custom parsing

				/**
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
				**/

				case 47:
					Log.Error("Plane sent ack", frm.Message())

				case 51:
					fallthrough
				case 40:
					// if frm.Channel.Endpoint().Conf() == endpoints[0] &&
					Log.Error("Plane sent a request", frm.Message())
					if waitingToSendWaypoints {
						// parameters, _ := getParameterNames(msgID, mavlinkCommon)
						Log.Info()
						Log.Infof("%T", rawValues[2])
						if rawValues[2] == "0" {
							node.WriteMessageAll(&ardupilotmega.MessageMissionItemInt{
								TargetSystem:    1, // SystemID of the plane (should probably be a parameter)
								TargetComponent: 1, // ComponentID (not exactly sure what this should be yet)
								Seq:             0,
								Frame:           ardupilotmega.MAV_FRAME_GLOBAL, // global frame allows us to give global coordinates (lat/lon in degrees for example)
								Command:         ardupilotmega.MAV_CMD_NAV_WAYPOINT,
								Current:         1,
								Autocontinue:    0,
								Param1:          0,               // Hold Time: ignored by fixed wing planes
								Param2:          10,              // Accept Radius (radial threshold in meters for a waypoint to be hit)
								Param3:          0,               // Pass Radius (idk what this is exactly yet)
								Param4:          0,               // Yaw to enter waypoint at
								X:               int32(30 * 1e7), // Latitude of waypoint (accepts an int which is the latitude * 10^7)
								Y:               int32(0 * 1e7),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
								Z:               30,              // altitude in meters over mean sea level (MSL)
								MissionType:     ardupilotmega.MAV_MISSION_TYPE_MISSION,
							})
							Log.Info("Sent a waypoint")
							// waitingToSendWaypoints = false
						} else if rawValues[2] == "1" {
							node.WriteMessageAll(&ardupilotmega.MessageMissionItemInt{
								TargetSystem:    1, // SystemID of the plane (should probably be a parameter)
								TargetComponent: 1, // ComponentID (not exactly sure what this should be yet)
								Seq:             1,
								Frame:           ardupilotmega.MAV_FRAME_GLOBAL, // global frame allows us to give global coordinates (lat/lon in degrees for example)
								Command:         ardupilotmega.MAV_CMD_NAV_WAYPOINT,
								Current:         1,
								Autocontinue:    0,
								Param1:          0,               // Hold Time: ignored by fixed wing planes
								Param2:          10,              // Accept Radius (radial threshold in meters for a waypoint to be hit)
								Param3:          0,               // Pass Radius (idk what this is exactly yet)
								Param4:          0,               // Yaw to enter waypoint at
								X:               int32(31 * 1e7), // Latitude of waypoint (accepts an int which is the latitude * 10^7)
								Y:               int32(0 * 1e7),  // Latitude of waypoint (accepts an int which is the latitude * 10^7)
								Z:               30,              // altitude in meters over mean sea level (MSL)
								MissionType:     ardupilotmega.MAV_MISSION_TYPE_MISSION,
							})
							Log.Info("Sent a waypoint")
							waitingToSendWaypoints = false
						}
					}
				}
			}
		}
	}

	go mavRouterParser()

	defer client.Close()

	for {
		Log.Info("waiting for next waypoints")
		nextWaypoints := <-sendWaypointToPlaneChannel
		Log.Info("got next waypoints")
		// <-sendWaypointToPlaneChannel
		Log.Info(nextWaypoints)
		nodeMutex.Lock()
		// let the plane know that we want to upload a given number of messages
		node.WriteMessageAll(&ardupilotmega.MessageMissionCount{
			TargetSystem:    1,
			TargetComponent: 0,
			Count:           2,
			MissionType:     ardupilotmega.MAV_MISSION_TYPE_MISSION,
		})
		nodeMutex.Unlock()
		waitingToSendWaypoints = true

	}

}
