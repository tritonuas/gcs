package mav

import (
	"errors"
	"fmt"

	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/common"
	"github.com/sirupsen/logrus"
	"github.com/tritonuas/hub/internal/mavlink/influxdb"
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
	connectedToPlane   bool
	planeConnType      string // examples: "serial", "udp", "tcp"
	planeAddress       string // examples: "/dev/ttyUSB0", "192.168.1.7:14550"
	planeEndpoint      gomavlib.EndpointConf
	influxdbClient     *influxdb.Client
	routerEndpoints    []gomavlib.EndpointConf
	mavlinkNode        *gomavlib.Node
	eventFrameHandlers []EventFrameHandler
}

// New creates a new mavlink client that can communicate with the plane and other mavlink devices (MissionPlanner/QGC)
//
// Parameters:
//   - influxCreds: Credentials to connect to InfluxDB. Needed for writing plane telemetry.
//   - planeConnInfo: Description of plane connection information. Format for TCP or UDP connections: "connType:address:port".
//     Format for serial connections: "connType:address". Examples: "udp:localhost:14551", "tcp:192.168.1.7:14550", "serial:/dev/ttyUSB0"
//   - routerDevicesConnInfo: variadic parameter that holds any number of strings with information to connect to Mavlink devices.
//     The router will be responsible for forwarding Mavlink EventFrames to them. The format of the strings matches that of the
//     planeConnInfo parameter.
func New(influxCreds influxdb.Credentials, planeConnInfo string, routerDevicesConnInfo ...string) *Client {
	c := &Client{}

	c.SetPlaneEndpoint(planeConnInfo)
	c.AddRouterEndpoints(routerDevicesConnInfo...)

	node, err := c.createNode()
	if err != nil {
		Log.Error(err)
	}

	c.mavlinkNode = node

	c.influxdbClient = influxdb.New(influxCreds)

	// TODO: setup a method and route to modify the handlers
	c.eventFrameHandlers = []EventFrameHandler{
		(*Client).forwardEventFrame,
		(*Client).writeMsgToInfluxDB,
		(*Client).handleMissionUpload,
		(*Client).handleMissionDownload,
		(*Client).monitorMission,
	}

	// verify the plane connection in the background to prevent the current goroutine from
	// blocking if the plane isn't connected
	go c.verifyPlaneConnection()

	return c
}

// IsConnected returns if the client is connected to the plane
func (c *Client) IsConnectedToPlane() bool {
	return c.connectedToPlane
}

// Listen will listen for incoming mavlink events.
// These events can include frames from the plane or other devices that
// send Mavlink packets.
func (c *Client) Listen() {
	for {
		if c.mavlinkNode != nil {
			break
		}
	}
	for e := range c.mavlinkNode.Events() {
		switch evt := e.(type) {
		case *gomavlib.EventChannelOpen:
			Log.Infof("Mavlink channel opened at %s", evt.Channel.String())
		case *gomavlib.EventChannelClose:
			Log.Infof("Mavlink channel closed at %s", evt.Channel.String())
		case *gomavlib.EventFrame:
			for _, handler := range c.eventFrameHandlers {
				handler(c, evt)
			}
		}
	}
}

// createNode will create a new mavlink node and return it.
// The node can be used to receive/send frames to various endpoints
func (c *Client) createNode() (*gomavlib.Node, error) {

	node, err := gomavlib.NewNode(gomavlib.NodeConf{
		Endpoints:           append(c.routerEndpoints, c.planeEndpoint),
		Dialect:             common.Dialect,
		OutVersion:          gomavlib.V2,
		OutSystemID:         systemID,
		OutComponentID:      componentID,
		StreamRequestEnable: true,
	})
	if err != nil {
		return nil, fmt.Errorf("%s. Reason: %w", errCreatingNode.Error(), err)
	}

	return node, nil
}
