package mav

import (
	"errors"
	"sync"

	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/common"
	"github.com/sirupsen/logrus"
	"github.com/tritonuas/hub/internal/influxdb"
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

	planeConnType      string // examples: "serial", "udp", "tcp"
	planeAddress       string // examples: "/dev/ttyUSB0", "192.168.1.7:14550"
	planeEndpoint      gomavlib.EndpointConf
	planeEndpointMutex *sync.Mutex

	routerEndpoints      []gomavlib.EndpointConf
	routerEndpointsMutex *sync.Mutex

	endpointsAltered bool

	mavlinkNode        *gomavlib.Node
	eventFrameHandlers []EventFrameHandler

	antennaTrackerIP   string
	antennaTrackerPort string
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

	c.planeEndpointMutex = &sync.Mutex{}
	c.routerEndpointsMutex = &sync.Mutex{}

	c.SetPlaneEndpoint(planeConnInfo)
	c.AddRouterEndpoints(routerDevicesConnInfo...)
	// c.updateNode()
	Log.Info(c.mavlinkNode)

	c.influxdbClient = influxdbClient

	// TODO: setup a method and route to modify the handlers
	c.eventFrameHandlers = []EventFrameHandler{
		(*Client).forwardEventFrame,
		(*Client).writeMsgToInfluxDB,
		// (*Client).handleMissionUpload,
		// (*Client).handleMissionDownload,
		// (*Client).monitorMission,
		// (*Client).forwardToAntennaTracker,
	}

	c.antennaTrackerIP = antennaTrackerIP
	c.antennaTrackerPort = antennaTrackerPort

	// verify the plane and antenna tracker connection in the background to prevent the current goroutine from
	// blocking if the plane/antenna tracker isn't connected
	go c.verifyPlaneConnection()
	go c.verifyAntennaTrackerConnection()

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
	// for c.mavlinkNode == nil {
	// 	Log.Error("Mavlink node has not been created. Trying again in 5 seconds ...")
	// 	time.Sleep(5 * time.Second)
	// 	c.updateNode()
	// }

	loop := func(n *gomavlib.Node, killChan chan bool) {
		for e := range n.Events() {
			select {
			case shouldKill := <-killChan:
				if shouldKill {
					return
				}
			default:
			}
			switch evt := e.(type) {
			case *gomavlib.EventChannelOpen:
				Log.Infof("Mavlink channel opened at %s", evt.Channel.Endpoint().Conf())
			case *gomavlib.EventChannelClose:
				Log.Infof("SUSSY %p", c.mavlinkNode)
				Log.Infof("Mavlink channel closed at %s", evt.Channel.Endpoint().Conf())
			case *gomavlib.EventFrame:
				for _, handler := range c.eventFrameHandlers {
					handler(c, evt, n)
				}
			}
		}
	}

	for {
		killChannel := make(chan bool, 1)
		node, err := gomavlib.NewNode(gomavlib.NodeConf{
			Endpoints:           append(c.routerEndpoints, c.planeEndpoint),
			Dialect:             common.Dialect,
			OutVersion:          gomavlib.V2,
			OutSystemID:         systemID,
			OutComponentID:      componentID,
			StreamRequestEnable: true,
		})

		if err != nil {
			Log.Errorf("%s. Reason: %s", errCreatingNode.Error(), err.Error())
		}

		go loop(node, killChannel)

		for !c.endpointsAltered {
		}
		killChannel <- true
	}
}

func (c *Client) updateEndpoints(planeEndpoint string, routerEndpoints []string) {
	// TODO return error
	c.planeEndpoint, _ = NewEndpoint(planeEndpoint)

	c.routerEndpoints = make([]gomavlib.EndpointConf, 0)
	for _, endptStr := range routerEndpoints {
		endpt, _ := NewEndpoint(endptStr)
		c.routerEndpoints = append(c.routerEndpoints, endpt)
	}

	c.endpointsAltered = true
}

// updateNode will create a new mavlink node and set it in the client.
// The node can be used to receive/send frames to various endpoints
// func (c *Client) updateNode() {
// 	endpoints := make([]gomavlib.EndpointConf, len(c.routerEndpoints)+1)

// 	// lock access to planeEndpoint and routerEndpoints to avoid them being
// 	// modified while we're copying them to be used in the new node
// 	c.routerEndpointsMutex.Lock()
// 	c.planeEndpointMutex.Lock()
// 	copy(endpoints, append(c.routerEndpoints, c.planeEndpoint))
// 	c.planeEndpointMutex.Unlock()
// 	c.routerEndpointsMutex.Unlock()

// 	Log.Info("ENDPOINTS")
// 	for _, e := range endpoints {
// 		Log.Info(e)
// 	}

// 	node, err := gomavlib.NewNode(gomavlib.NodeConf{
// 		Endpoints:           append(c.routerEndpoints, c.planeEndpoint),
// 		Dialect:             common.Dialect,
// 		OutVersion:          gomavlib.V2,
// 		OutSystemID:         systemID,
// 		OutComponentID:      componentID,
// 		StreamRequestEnable: true,
// 	})
// 	if err != nil {
// 		Log.Errorf("%s. Reason: %s", errCreatingNode.Error(), err.Error())
// 	}
// 	c.mavlinkNode = node
// 	Log.Infof("SUSSY1 %p", c.mavlinkNode)
// }
