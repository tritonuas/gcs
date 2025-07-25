// Package mav provides functionality for communicating with the plane and
// other MAVLink-enabled devices such as the antenna tracker.
package mav

import (
	"fmt"
	"net"

	"github.com/aler9/gomavlib"
	"github.com/aler9/gomavlib/pkg/dialects/common"
)

// verifyAntennaTrackerConnection will attempt to make a connection with the antenna tracker.
// This function will hang until a connection is established.
func (c *Client) verifyAntennaTrackerConnection() {
	_, err := net.Dial("udp", fmt.Sprintf("%s:%s", c.antennaTrackerIP, c.antennaTrackerPort))
	if err != nil {
		c.connectedToAntennaTracker = false
		Log.Errorf("Error with connecting to antenna tracker. Reason: %s", err.Error())
		return
	}
	c.connectedToAntennaTracker = true
}

// forwardToAntennaTracker is an event handler that will take an event frame and forward it to the antenna tracker.
// The format is latitude, longitude, and altitude (MSL) of the plane separated by commas.
// Latitude and Longitude are in degrees. Altitude is in meters.
//
// Example output:
// "34.566,-74.567,200"
func (c *Client) forwardToAntennaTracker(evt *gomavlib.EventFrame, _ *gomavlib.Node) {
	if msg, ok := evt.Frame.GetMessage().(*common.MessageGlobalPositionInt); ok {
		conn, err := net.Dial("udp", fmt.Sprintf("%s:%s", c.antennaTrackerIP, c.antennaTrackerPort))
		if err != nil {
			c.connectedToAntennaTracker = false
			Log.Errorf("Error with connecting to antenna tracker. Reason: %s", err.Error())
			return
		}

		c.connectedToAntennaTracker = true

		lat := float64(msg.Lat) / 1e07
		lon := float64(msg.Lon) / 1e07
		alt := float64(msg.Alt) / 1000
		message := fmt.Sprintf("%f,%f,%f", lat, lon, alt)

		_, err = conn.Write([]byte(message))
		if err != nil {
			Log.Errorf("Error with connecting to antenna tracker. Reason: %s", err.Error())
		}
		defer func() {
			if cerr := conn.Close(); cerr != nil {
				Log.Errorf("Error closing antenna tracker connection: %v", cerr)
			}
		}()

	}
}
