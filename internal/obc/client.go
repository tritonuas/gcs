package obc

import (
	"bytes"
	"encoding/json"

	"github.com/tritonuas/gcs/internal/obc/airdrop"
	"github.com/tritonuas/gcs/internal/obc/pp"
	"github.com/tritonuas/gcs/internal/utils"
)

// Generic client struct for interfacing with the OBC
type Client struct {
	httpClient       *utils.Client
	urlBase          string
	timeout          int
	CameraStatus     bool
	MockCameraStatus bool
}

// Creates a new client struct and initializes all its values
func NewClient(urlBase string, timeout int) *Client {
	client := &Client{

		urlBase:          "http://" + urlBase,
		timeout:          timeout,
		CameraStatus:     false,
		MockCameraStatus: false,
	}

	// setup http_client
	client.httpClient = utils.NewClient(urlBase, timeout)

	return client
}

/*
Requests a newly generated Initial Path from the OBC via GET request

Returns the initial path in JSON form
*/
func (client *Client) GenerateNewInitialPath() ([]byte, int) {
	body, httpErr := client.httpClient.Get("/path/initial/new")
	return body, httpErr.Status
}

/*
Posts the initial path to the OBC so that it can be uploaded to the plane
*/
func (client *Client) PostInitialPath(path []pp.Waypoint) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(path)

	if err != nil {
		return nil, -1
	}

	body, httpErr := client.httpClient.Post("/path/initial", &buf)
	return body, httpErr.Status
}

/*
Requests the currently uploaded initial path on the OBC
*/
func (client *Client) GetCurrentInitialPath() ([]byte, int) {
	body, httpErr := client.httpClient.Get("/path/initial")
	return body, httpErr.Status
}

/*
Sends a message to the OBC to start the mission
*/
func (client *Client) StartMission() ([]byte, int) {
	body, httpErr := client.httpClient.Post("/mission/start", &bytes.Buffer{}) // empty bc no data
	return body, httpErr.Status
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

/*
Sends initial waypoints to the OBC via POST request.

TODO: this function is exactly the same as PostAirdropWaypoints, but with the route changed. This sucks and we should change it.
*/
func (client *Client) PostInitialWaypoint(waypoints *[]pp.Waypoint) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(waypoints)

	if err != nil {
		return nil, -1
	}

	body, httpErr := client.httpClient.Post("/waypoints/initial", &buf)
	return body, httpErr.Status
}

/*
Gets the initial competition waypoints uploaded to the obc
*/
func (client *Client) GetInitialWaypoints() ([]byte, int) {
	body, httpErr := client.httpClient.Get("/waypoints/initial")
	return body, httpErr.Status
}

/*
Sends POST request to tell imaging camera (the one on the bottom of the plane; not dynamic avoidance) to start taking pictures periodically.

Also updates the CameraStatus field.
*/
func (client *Client) StartCamera() int {
	_, httpErr := client.httpClient.Post("/camera/start", nil)
	client.CameraStatus = true
	return httpErr.Status
}

/*
Sends POST request to tell imaging camera (the one on the bottom of the plane; not dynamic avoidance) to stop taking pictures.

Also updates the CameraStatus field.
*/
func (client *Client) StopCamera() int {
	_, httpErr := client.httpClient.Post("/camera/stop", nil)
	client.CameraStatus = false
	return httpErr.Status
}

/*
Sends POST request to tell mock camera to start taking pictures periodically.

Also updates the MockCameraStatus field
*/
func (client *Client) StartMockCamera() int {
	_, httpErr := client.httpClient.Post("/camera/mock/start", nil)
	client.MockCameraStatus = true
	return httpErr.Status
}

/*
Sends POST request to tell mock camera to stop taking pictures.

Also updates the MockCameraStatus field
*/
func (client *Client) StopMockCamera() int {
	_, httpErr := client.httpClient.Post("/camera/mock/stop", nil)
	client.MockCameraStatus = false
	return httpErr.Status
}

/*
Sends GET request to OBC to ask for the camera to take a picture and send the image down immediately.

Note that this returns an "image" as a byte array (probably base64 encoded?)
*/
func (client *Client) SendCameraCapture() ([]byte, int) {
	image, httpErr := client.httpClient.Get("/camera/capture")
	return image, httpErr.Status
}

/*
Sends POST request to OBC to do manual bottle SWAP
*/
func (client *Client) ManualBottleSwap(bottle airdrop.BottleSwap) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(bottle)

	if err != nil {
		return nil, -1
	}

	body, httpErr := client.httpClient.Post("/mission/airdrop/manual/swap", &buf)
	return body, httpErr.Status
}

/*
Sends POST request to OBC to do manual bottle DROP
*/
func (client *Client) ManualBottleDrop() ([]byte, int) {
	body, httpErr := client.httpClient.Post("/mission/airdrop/manual/drop", nil)
	return body, httpErr.Status
}
