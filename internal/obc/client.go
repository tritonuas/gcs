package obc

import (
	"bytes"
	"encoding/json"

	"github.com/tritonuas/gcs/internal/obc/pp"
	"github.com/tritonuas/gcs/internal/utils"
)

// Generic client struct for interfacing with the OBC
type Client struct {
	httpClient *utils.Client
	urlBase    string
	timeout    int
}

// Creates a new client struct and initializes all its values
func NewClient(urlBase string, timeout int) *Client {
	client := &Client{

		urlBase: "http://" + urlBase,
		timeout: timeout,
	}

	// setup http_client
	client.httpClient = utils.NewClient(urlBase, timeout)

	return client
}

/*
Sends Mission data (boundaries) to the OBC via POST request.

Returns potential errors and returned status code
*/
func (client *Client) PostMission(mission *pp.Mission) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(mission)

	if err != nil {
		return nil, -1 // not sure what to return for the status code since the request hasn't happened yet
	}

	body, httpErr := client.httpClient.Post("/mission", &buf)
	return body, httpErr.Status
}

// wrap httpClient function
func (client *Client) IsConnected() (bool, string) {
	return client.httpClient.IsConnected()
}

// Sends Airdrop waypoints to the OBC via POST request.
func (client *Client) PostAirdropWaypoints(waypoints *[]pp.Waypoint) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(waypoints)

	if err != nil {
		return nil, -1
	}

	body, httpErr := client.httpClient.Post("/waypoints/airdrop", &buf)
	return body, httpErr.Status
}
