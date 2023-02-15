package mav

import (
	"errors"
	"fmt"
	"strings"

	"github.com/aler9/gomavlib"
)

var errUndefinedEndpointType = errors.New("mavlink endpoint has an undefined type")

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
	switch endpoint := endpointConf.(type) {
	case *gomavlib.EndpointSerial:
		return endpoint.Address, nil
	case *gomavlib.EndpointTCPClient:
		return endpoint.Address, nil
	case *gomavlib.EndpointUDPClient:
		return endpoint.Address, nil
	default:
		return "", errUndefinedEndpointType
	}
}

// GetRouterEndpoints will return a list of endpoints (represented with strings)
// that the router is forwarding EventFrames to.
func (c *Client) GetRouterEndpoints() []string {
	c.routerEndpointsMutex.Lock()
	endpoints := make([]string, len(c.routerEndpoints))
	for i, endpointConf := range c.routerEndpoints {
		endpointString, err := StringifyEndpoint(endpointConf)
		if err == nil {
			endpoints[i] = endpointString
		}
	}
	c.routerEndpointsMutex.Unlock()
	return endpoints
}

// AddRouterEndpoints will add multiple endpoints to be used for the router.
// For the changes to take affect, the node must be recreated with the
// updated list of endpoints.
// Parame
//   - routerDevicesConnInfo: variadic parameter that holds any number of strings with information to connect to Mavlink devices.
//     The router will be responsible for forwarding Mavlink EventFrames to them. Format for TCP or UDP connections: "connType:address:port".
//     Format for serial connections: "connType:address". Examples: "udp:localhost:14551", "tcp:192.168.1.7:14550", "serial:/dev/ttyUSB0"
func (c *Client) AddRouterEndpoints(routerDevicesConnInfo ...string) {
	for _, deviceConnInfo := range routerDevicesConnInfo {
		endpoint, err := NewEndpoint(deviceConnInfo)
		if err != nil {
			Log.Errorf(`Cannot add endpoint with connection info: "%s". Reason: %s`, deviceConnInfo, err.Error())
			return
		}
		c.routerEndpointsMutex.Lock()
		c.routerEndpoints = append(c.routerEndpoints, endpoint)
		c.routerEndpointsMutex.Unlock()
	}
	c.updateNode()
}

// RemoveRouterEndpoint will remove an endpoint from being used by the router.
// For the changes to take affect, the node must be recreated with the
// updated list of endpoints.
// Parameters:
//   - endpointConnInfo: Description of endpoint connection information. Format for TCP or UDP connections: "connType:address:port".
//     Format for serial connections: "connType:address". Examples: "udp:localhost:14551", "tcp:192.168.1.7:14550", "serial:/dev/ttyUSB0"
//
// Returns true if the endpoint was successfully removed, false otherwise.
func (c *Client) RemoveRouterEndpoint(deviceConnInfo string) bool {
	c.routerEndpointsMutex.Lock()
	for i, endpoint := range c.routerEndpoints {
		endpointString, err := StringifyEndpoint(endpoint)
		if err != nil {
			Log.Debug(err)
			continue
		}
		// remove the endpoint that matches
		if deviceConnInfo == endpointString {
			c.routerEndpoints = append(c.routerEndpoints[:i], c.routerEndpoints[i+1:]...)
			c.routerEndpointsMutex.Unlock()
			return true
		}
	}
	c.routerEndpointsMutex.Unlock()
	return false
}
