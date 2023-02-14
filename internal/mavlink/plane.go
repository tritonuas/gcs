package mav

import (
	"net"
	"strings"
	"time"

	"github.com/goburrow/serial"
)

// StartMissionUpload will send MISSION_COUNT to the plane
// and startup the mission uploading sequence.
//
// See https://mavlink.io/en/services/mission.html#uploading_mission for details
// on the entire mission uploading process.
func (c *Client) StartMissionUpload() {
	// TODO: place waypoints in a channel to be read
	// by handleMissionUpload later

	// c.mavlinkNode.WriteMessageAll()
	// OR
	// c.mavlinkNode.WriteMessageTo() need plane channel somehow
	// maybe can store plane channel in EventChannelOpen if the systemID matches the plane's
}

// StartMissionDownload will send MISSION_REQUEST_INT to the plane
// and startup the mission downloading sequence.
//
// See https://mavlink.io/en/services/mission.html#download_mission for details
// on the entire mission downloading process.
func (c *Client) StartMissionDownload() {
	// send a MISSION_REQUEST_INT to the plane

	// c.mavlinkNode.WriteMessageAll()
	// OR
	// c.mavlinkNode.WriteMessageTo() need plane channel somehow
	// maybe can store plane channel in EventChannelOpen if the systemID matches the plane's

}

// SetPlaneEndpoint will update the endpoint for the plane
//
// Parameters:
//   - planeConnInfo: Format for TCP or UDP connections: "connType:address:port".
//     Format for serial connections: "connType:address". Examples: "udp:localhost:14551", "tcp:192.168.1.7:14550", "serial:/dev/ttyUSB0"
func (c *Client) SetPlaneEndpoint(planeConnInfo string) {
	planeConnInfoSplit := strings.Split(planeConnInfo, ":")
	c.planeConnType = planeConnInfoSplit[0]
	c.planeAddress = strings.Join(planeConnInfoSplit[1:], ":")

	planeEndpoint, err := NewEndpoint(strings.Join([]string{c.planeConnType, c.planeAddress}, ":"))
	if err != nil {
		Log.Errorf("could not create endpoint for connecting to plane. Reason: %s", err.Error())
		return
	}
	c.planeEndpoint = planeEndpoint
}

// verifyPlaneConnection will attempt to make a connection with the plane.
// This function will hang until a connection is established.
func (c *Client) verifyPlaneConnection() {
	switch c.planeConnType {
	case "serial":
		for {
			_, err := serial.Open(&serial.Config{Address: c.planeAddress})
			if err == nil {
				c.connectedToPlane = true
				Log.Infof("Successfully connected to plane at %s:%s", c.planeConnType, c.planeAddress)
				return
			}
			c.connectedToPlane = false
			Log.Warnf("Connection to plane failed at serial port %s. Trying to establish connection again in %d seconds...", c.planeAddress, planeConnRefreshTimer)
			time.Sleep(time.Duration(planeConnRefreshTimer) * time.Second)
		}
	case "tcp":
		fallthrough
	case "udp":
		for {
			_, err := net.Dial(c.planeConnType, c.planeAddress)
			if err == nil {
				c.connectedToPlane = true
				Log.Infof("Successfully connected to plane at %s:%s", c.planeConnType, c.planeAddress)
				return
			}
			c.connectedToPlane = false
			Log.Warnf("Connection to plane failed at %s:%s. Trying to establish connection again in %d seconds...", c.planeConnType, c.planeAddress, planeConnRefreshTimer)
			time.Sleep(time.Duration(planeConnRefreshTimer) * time.Second)
		}

	default:
		c.connectedToPlane = false
		Log.Errorf(`Invalid Mavlink plane connection type "%s" provided. Change the connection type to "udp", "tcp", or "serial"`, c.planeConnType)
		// try again in a few seconds in the chance that the plane connection info has been updatd by the SetPlaneEndpoint method
		time.Sleep(time.Duration(planeConnRefreshTimer) * time.Second)
		c.verifyPlaneConnection()

	}

}
