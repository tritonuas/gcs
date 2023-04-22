package mav

import (
	"errors"
	"time"

	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/common"
	"github.com/sirupsen/logrus"
	"github.com/tritonuas/gcs/internal/influxdb"
)

// log is the logger for the mav package
var Log = logrus.New()

var errCreatingNode = errors.New("could not create mavlink node to communicate with Plane and other Mavlink clients")

// planeConnRefreshTimer is the number of seconds Hub will wait until attempting to reconnect to the plane
const planeConnRefreshTimer int = 5

// systemID is added to every outgoing frame and used to identify Hub's mavlink node
// on the network. Shouldn't match any other mavlink device on the network.
// More info here: https://mavlink.io/en/guide/routing.html
const systemID byte = 125

// componentID added to every outgoing frame and used to identify the component of Hub
// that is sending/receiving Mavlink messages. More info here: https://mavlink.io/en/guide/routing.html
// Some common component types: https://mavlink.io/en/messages/common.html#MAV_COMPONENT
const componentID byte = 1

// Client holds data relating to communicating to the plane and other mavlink devices (MissionPlanner/QGC).
//
// It has three main functionalities:
//  1. Listen for incoming mavlink messages and handle them appropriately
//  2. Route messages between mavlink endpoints (ex: forward plane telemetry
//     to MissionPlanner on another computer)
//  3. Send messages and commands to the plane
type Client struct {
	influxdbClient *influxdb.Client

	connectedToPlane          bool
	connectedToAntennaTracker bool

	endpointConnInfo EndpointData

	// mavlinkNode        *gomavlib.Node
	eventFrameHandlers []EventFrameHandler

	antennaTrackerIP   string
	antennaTrackerPort string

	LatestBatteryInfo map[uint8]int

	endpointChangeChannel chan bool // Note: whether it is true/false does not make a difference. Any val signifies change.
}

// Kill kills Listen
func (c *Client) Kill() {
	c.endpointChangeChannel <- false
}

// New creates a new mavlink client that can communicate with the plane and other mavlink devices (MissionPlanner/QGC)
//
// Parameters:
//   - influxdbClient: Client to communicate with Influx database that stores plane telemtry
//   - planeConnInfo: Description of plane connection information. Format for TCP or UDP connections: "connType:address:port".
//     Format for serial connections: "connType:address". Examples: "udp:localhost:14551", "tcp:192.168.1.7:14550", "serial:/dev/ttyUSB0"
//   - routerDevicesConnInfo: variadic parameter that holds any number of strings with information to connect to Mavlink devices.
//     The router will be responsible for forwarding Mavlink EventFrames to them. The format of the strings matches that of the
//     planeConnInfo parameter.
func New(influxdbClient *influxdb.Client, antennaTrackerIP string, antennaTrackerPort string, planeConnInfo string, routerDevicesConnInfo ...string) *Client {
	c := &Client{}

	actualRouterDevices := []string{}
	for _, routerDeviceConnInfo := range routerDevicesConnInfo {
		if routerDeviceConnInfo != "" {
			actualRouterDevices = append(actualRouterDevices, routerDeviceConnInfo)
		}
	}
	c.endpointConnInfo = EndpointData{Plane: planeConnInfo, Router: actualRouterDevices}

	c.influxdbClient = influxdbClient

	c.LatestBatteryInfo = make(map[uint8]int)

	// TODO: setup a method and route to modify the handlers
	c.eventFrameHandlers = []EventFrameHandler{
		(*Client).forwardEventFrame,
		(*Client).writeMsgToInfluxDB,
		(*Client).handleMissionUpload,
		(*Client).handleMissionDownload,
		(*Client).monitorMission,
		(*Client).forwardToAntennaTracker,
		(*Client).handleBatteryUpdate,
	}

	c.antennaTrackerIP = antennaTrackerIP
	c.antennaTrackerPort = antennaTrackerPort

	c.endpointChangeChannel = make(chan bool, 1)

	// verify the plane and antenna tracker connection in the background to prevent the current goroutine from
	// blocking if the plane/antenna tracker isn't connected
	go c.verifyPlaneConnection()
	go c.verifyAntennaTrackerConnection()

	Log.Error(actualRouterDevices)

	return c
}

// IsConnected returns if the client is connected to the plane
func (c *Client) IsConnectedToPlane() bool {
	return c.connectedToPlane
}

// IsConnected returns if the client is connected to the antenna tracker
func (c *Client) IsConnectedToAntennaTracker() bool {
	return c.connectedToAntennaTracker
}

// Listen will listen for incoming mavlink events.
// These events can include frames from the plane or other devices that
// send Mavlink packets.
func (c *Client) Listen() {
	loop := func(n *gomavlib.Node, killChan chan bool) bool {
		Log.Info("Starting up new mavlink Listen loop")
		for e := range n.Events() {
			select {
			case b := <-c.endpointChangeChannel:
				return b
			default:
				// Do nothing if the channel is empty
			}
			switch evt := e.(type) {
			case *gomavlib.EventChannelOpen:
				Log.Infof("Mavlink channel opened at %s", evt.Channel.Endpoint().Conf())
			case *gomavlib.EventChannelClose:
				Log.Infof("Mavlink channel closed at %s", evt.Channel.Endpoint().Conf())
			case *gomavlib.EventFrame:
				for _, handler := range c.eventFrameHandlers {
					handler(c, evt, n)
				}
			}
		}
		return false
	}

	for {
		// TODO: handle errors properly in this loop
		planeEndpoint, _ := NewEndpoint(c.endpointConnInfo.Plane) //nolint: errcheck

		routerEndpoints := make([]gomavlib.EndpointConf, 0)
		for _, endptStr := range c.endpointConnInfo.Router {
			endpt, err := NewEndpoint(endptStr)
			if err != nil {
				continue
			}
			routerEndpoints = append(routerEndpoints, endpt)
		}

		node, err := gomavlib.NewNode(gomavlib.NodeConf{
			Endpoints:           append(routerEndpoints, planeEndpoint),
			Dialect:             common.Dialect,
			OutVersion:          gomavlib.V2,
			OutSystemID:         systemID,
			OutComponentID:      componentID,
			StreamRequestEnable: true,
		})

		if err != nil {
			Log.Errorf("%s. Reason: %s", errCreatingNode.Error(), err.Error())
			Log.Infof("Waiting %d seconds before retrying Mav connection", planeConnRefreshTimer)
			time.Sleep(time.Second * time.Duration(planeConnRefreshTimer))
			continue
		}

		if !loop(node, c.endpointChangeChannel) {
			return
		}
	}
}

// UpdateEndpoints updates mavilnk endpoints
func (c *Client) UpdateEndpoints(planeEndpoint string, routerEndpoints []string) {
	c.endpointConnInfo.Plane = planeEndpoint
	c.endpointConnInfo.Router = routerEndpoints
	c.endpointChangeChannel <- true
}
