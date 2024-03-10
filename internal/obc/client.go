package obc

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/tritonuas/gcs/internal/obc/camera"
	"github.com/tritonuas/gcs/internal/protos"
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
Requests a newly generated Initial Path from the OBC via GET request

Returns the initial path in JSON form
*/
func (client *Client) GenerateNewInitialPath() ([]byte, int) {
	body, httpErr := client.httpClient.Get("/path/initial/new")
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
Validates the currently generated initial path on the OBC
*/
func (client *Client) ValidateInitialPath() ([]byte, int) {
	body, httpErr := client.httpClient.Post("/path/initial/validate", nil)
	return body, httpErr.Status
}

/*
Sends Mission data (boundaries) to the OBC via POST request.

Returns potential errors and returned status code
*/
func (client *Client) PostMission(mission *protos.Mission) ([]byte, int) {
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
func (client *Client) PostAirdropTargets(waypoints *[]protos.AirdropTarget) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(waypoints)

	if err != nil {
		return nil, -1
	}

	body, httpErr := client.httpClient.Post("/airdrop", &buf)
	return body, httpErr.Status
}

/*
Sends POST request to tell imaging camera (the one on the bottom of the plane; not dynamic avoidance) to start taking pictures periodically.

Also updates the CameraStatus field.
*/
func (client *Client) StartCamera() (string, int) {
	resp, httpErr := client.httpClient.Post("/camera/start", nil)
	return string(resp), httpErr.Status
}

/*
Sends POST request to tell imaging camera (the one on the bottom of the plane; not dynamic avoidance) to stop taking pictures.

Also updates the CameraStatus field.
*/
func (client *Client) StopCamera() (string, int) {
	resp, httpErr := client.httpClient.Post("/camera/stop", nil)
	return string(resp), httpErr.Status
}

/*
Sends POST request to tell mock camera to start taking pictures periodically.

Also updates the MockCameraStatus field
*/
func (client *Client) StartMockCamera() int {
	_, httpErr := client.httpClient.Post("/camera/mock/start", nil)
	return httpErr.Status
}

/*
Sends POST request to tell mock camera to stop taking pictures.

Also updates the MockCameraStatus field
*/
func (client *Client) StopMockCamera() int {
	_, httpErr := client.httpClient.Post("/camera/mock/stop", nil)
	return httpErr.Status
}

/*
Sends GET request to OBC to ask for the camera to take a picture and send the image down immediately.

Note that this returns an "image" as a byte array (probably base64 encoded?)
*/
func (client *Client) GetCameraCapture() ([]byte, int) {
	image, httpErr := client.httpClient.Get("/camera/capture")
	return image, httpErr.Status
}

// GetCameraConfig gets the current camera configuration from the OBC in JSON format
func (client *Client) GetCameraConfig() ([]byte, int) {
	body, httpErr := client.httpClient.Get("/camera/config")
	return body, httpErr.Status
}

// PostCameraConfig posts a new camera configuration to the OBC
func (client *Client) PostCameraConfig(config camera.Config) ([]byte, int) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(config)

	if err != nil {
		return nil, -1
	}

	body, httpErr := client.httpClient.Post("/camera/config", &buf)
	return body, httpErr.Status
}

// GetCamereStatus gets the current camera status from the OBC
func (client *Client) GetCameraStatus() (camera.Status, int) {
	body, httpErr := client.httpClient.Get("/camera/status")
	if httpErr.Get {
		return camera.Status{}, httpErr.Status
	}
	var cameraStatus camera.Status
	err := json.Unmarshal(body, &cameraStatus)
	if err != nil {
		println(err.Error())
		return camera.Status{}, http.StatusBadRequest
	}
	return cameraStatus, httpErr.Status
}
