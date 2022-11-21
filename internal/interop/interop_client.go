/*
Core interoperability client module

This module provides a Go interface to the SUAS interoperability API.
This module is designed to mimic the official python interface found
here: https://github.com/auvsi-suas/interop/blob/master/client/auvsi_suas/client/client.py
*/
package interop

import (
	"bytes"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	ut "github.com/tritonuas/hub/internal/utils"
)

var Log = logrus.New()

type Client struct {
	httpClient *ut.Client
	url        string
	username   string
	password   string
	timeout    int
}

// IsConnected checks to see if hte http client object is not null
func (c *Client) IsConnected() bool {
	return c.httpClient != nil
}

// EstablishInteropConnection keeps trying to connect to the interop server
// every waitTime seconds, and exits once it has connected
func EstablishInteropConnection(waitTime int, interopURL string, user string, pass string, timeout int, c chan *Client) {
	Log.Infof("Creating Interop Client connected to %s", interopURL)

	var client *Client
	var err ut.HTTPError
	for {
		// Try creating a new client and authenticating it
		client, err = NewClient(interopURL, user, pass, timeout)

		// Only break out of the loop if there was no error in authenticating the client
		// Otherwise, wait for waitTime seconds and try again.
		if err.Post {
			Log.Warningf("Client to Interop failed. Retrying in %d seconds.", waitTime)
			time.Sleep(time.Duration(waitTime) * time.Second)
		} else {
			Log.Info("Interop Client successfully authenticated.")
			break
		}
	}

	c <- client
}

// NewClient creates creates an instance of the interop Client struct
// to make requests with the interop server.
// func NewClient(url string, username string, password string, timeout int, max_concurrent int, max_retries int) *Client{
func NewClient(url string, username string, password string, timeout int) (*Client, ut.HTTPError) {
	client := &Client{
		url:      "http://" + url,
		username: username,
		password: password,
		timeout:  timeout,
	}

	// setup http_client
	client.httpClient = ut.NewClient(url, timeout)

	// jsonify authentication
	auth := map[string]string{"username": username, "password": password}
	authJSON, err := json.Marshal(auth)
	Log.Error(err)

	// All endpoints are authenticated, so always login
	_, intErr := client.httpClient.Post("/api/login", bytes.NewBuffer(authJSON))

	return client, intErr
}

// GetUsername returns the username for our interop connection
func (c *Client) GetUsername() string {
	return c.username
}

// GetTeams gets the statuses of all the teams registered in the server
func (c *Client) GetTeams() ([]byte, ut.HTTPError) {
	data, err := c.httpClient.Get("/api/teams")

	return data, err
}

// GetMission gets the mission at the given mission id value
func (c *Client) GetMission(id int) ([]byte, ut.HTTPError) {
	uri := fmt.Sprintf("/api/missions/%d", id)
	data, err := c.httpClient.Get(uri)

	return data, err
}

// PostTelemetry posts the ship's telemetry data to the server
func (c *Client) PostTelemetry(telem []byte) ut.HTTPError {
	// Post telemetry to server
	_, err := c.httpClient.Post("/api/telemetry", bytes.NewReader(telem))

	return err
}

// GetODLCs gets a list of ODLC objects that have been uploaded. To not limit the
// scope to a certain mission, pass through a negative number to mission.
func (c *Client) GetODLCs(missionID int) ([]byte, ut.HTTPError) {
	uri := "/api/odlcs"
	// Specify a specific mission if the caller chooses to
	if missionID > -1 {
		uri += fmt.Sprintf("?mission=%d", missionID)
	}

	// Get request to the server
	data, err := c.httpClient.Get(uri)

	return data, err
}

// GetODLC gets a single ODLC with the ODLC's id
func (c *Client) GetODLC(id int) ([]byte, ut.HTTPError) {
	uri := fmt.Sprintf("/api/odlcs/%d", id)

	// Get byte array from the server
	data, err := c.httpClient.Get(uri)

	return data, err
}

// PostODLC posts the ODLC object to the server and then returns the data
// of an odlc with the id parameter filled in
func (c *Client) PostODLC(odlc []byte) ([]byte, ut.HTTPError) {
	// Post the json to the server
	updatedODLC, err := c.httpClient.Post("/api/odlcs", bytes.NewReader(odlc))

	return updatedODLC, err
}

// PutODLC sends a PUT request to the server, updating any parameters of a
// specific ODLC with the values passed through.
func (c *Client) PutODLC(id int, odlc []byte) ([]byte, ut.HTTPError) {
	uri := fmt.Sprintf("/api/odlcs/%d", id)

	// Put the json to the server
	newOdlc, err := c.httpClient.Put(uri, bytes.NewReader(odlc))

	return newOdlc, err
}

// DeleteODLC deletes the ODLC at the specified id number
func (c *Client) DeleteODLC(id int) ut.HTTPError {
	uri := fmt.Sprintf("/api/odlcs/%d", id)
	_, err := c.httpClient.Delete(uri)

	return err
}

// GetODLCImage gets the raw binary image content of a specified ODLC that has
// already had image data uploaded to the server
func (c *Client) GetODLCImage(id int) ([]byte, ut.HTTPError) {
	uri := fmt.Sprintf("/api/odlcs/%d/image", id)

	body, err := c.httpClient.Get(uri)

	return body, err
}

// PutODLCImage puts the binary image content of the ODLC to the server for the
// specified ODLC id
func (c *Client) PutODLCImage(id int, image []byte) ut.HTTPError {
	uri := fmt.Sprintf("/api/odlcs/%d/image", id)

	_, err := c.httpClient.Put(uri, bytes.NewReader(image))

	return err
}

// DeleteODLCImage deletes the image saved at the specified ODLC
func (c *Client) DeleteODLCImage(id int) ut.HTTPError {
	uri := fmt.Sprintf("/api/odlcs/%d/image", id)

	_, err := c.httpClient.Delete(uri)

	return err
}
