package mav

import (
	"errors"
	"fmt"
	"strings"

	"github.com/aler9/gomavlib"
)

var errUndefinedEndpointType = errors.New("mavlink endpoint has an undefined type")

// EndpointData contains the mavlink endpoints for the plane and router. The
// mavlink client will listen for messages from the plane and forward messages
// to all the router endpoints.
type EndpointData struct {
	Plane  string   `json:"plane"`
	Router []string `json:"router"`
}

// NewEndpoint creates a new Mavlink endpoint and returns it
//
// Parameters:
//   - mavDevice:Format for TCP or UDP connections: "connType:address:port".
//     Format for serial connections: "connType:address". Examples: "udp:localhost:14551", "tcp:192.168.1.7:14550", "serial:/dev/ttyUSB0"
//
// Returns:
//   - gomavlib.EndpointConf: Endpoint to be used to communicate with
//   - error: nil unless an invalid connection type is provided
func NewEndpoint(mavDeviceConnInfo string) (gomavlib.EndpointConf, error) {
	mavDeviceSplit := strings.Split(mavDeviceConnInfo, ":")

	// Stores the type of device where information will be read from (udp, tcp, or serial connection)
	connType := mavDeviceSplit[0]
	address := strings.Join(mavDeviceSplit[1:], ":")

	switch connType {
	case "serial":
		return gomavlib.EndpointSerial{Address: fmt.Sprintf("%s:57600", address)}, nil

	case "udp":
		return gomavlib.EndpointUDPClient{Address: address}, nil

	case "tcp":
		return gomavlib.EndpointTCPClient{Address: address}, nil

	default:
		return nil, errUndefinedEndpointType
	}
}

// StringifyEndpoint will fetch a string represnetation of an endpoint
// depending on the endpoint type.
func StringifyEndpoint(endpointConf gomavlib.EndpointConf) (string, error) {
	Log.Infof("endpoint is %s %T", endpointConf, endpointConf)
	switch endpoint := endpointConf.(type) {
	case gomavlib.EndpointSerial:
		return fmt.Sprintf("serial:%s", endpoint.Address), nil
	case gomavlib.EndpointTCPClient:
		return fmt.Sprintf("tcp:%s", endpoint.Address), nil
	case gomavlib.EndpointUDPClient:
		return fmt.Sprintf("udp:%s", endpoint.Address), nil
	default:
		return "", errUndefinedEndpointType
	}
}

// GetRouterEndpoints will return a list of endpoints (represented with strings)
// that the router is forwarding EventFrames to.
func (c *Client) GetRouterEndpoints() []string {
	return c.endpointConnInfo.Router
}
