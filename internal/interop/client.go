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
	"io"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"time"

	"github.com/sirupsen/logrus"
)

var Log = logrus.New()

type Client struct {
	client   *http.Client
	url      string
	username string
	password string
	timeout  int
}

// EstablishInteropConnection keeps trying to connect to the interop server
// every waitTime seconds, and exits once it has connected
func EstablishInteropConnection(waitTime int, interopURL string, user string, pass string, timeout int, c chan *Client) {
	Log.Infof("Creating Interop Client connected to %s", interopURL)

	var client *Client
	var err InteropError
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
func NewClient(url string, username string, password string, timeout int) (*Client, InteropError) {
	client := &Client{
		url:      "http://" + url,
		username: username,
		password: password,
		timeout:  timeout,
	}

	// setup client with cookies
	cookieJar, _ := cookiejar.New(nil)
	client.client = &http.Client{
		Jar:     cookieJar,
		Timeout: time.Duration(timeout) * time.Second,
	}

	// jsonify authentication
	auth := map[string]string{"username": username, "password": password}
	authJSON, _ := json.Marshal(auth)

	// All endpoints are authenticated, so always login
	_, intErr := client.Post("/api/login", bytes.NewBuffer(authJSON))

	return client, intErr
}

// Get makes a GET request to server.
func (c *Client) Get(uri string) ([]byte, InteropError) {
	intErr := NewInteropError()

	resp, err := c.client.Get(c.url + uri)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		intErr.Get = true
		return nil, *intErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != 200 {
		intErr.Get = true
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	Log.Debugf("GET - %s - %d", uri, resp.StatusCode)

	return body, *intErr
}

// Post makes a POST request to server.
func (c *Client) Post(uri string, msg io.Reader) ([]byte, InteropError) {
	intErr := NewInteropError()

	resp, err := c.client.Post(c.url+uri, "application/json", msg)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		intErr.Post = true
		return nil, *intErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != 200 {
		intErr.Post = true
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	Log.Debugf("POST - %s - %d", uri, resp.StatusCode)

	return body, *intErr
}

// Put makes a PUT request to the server
func (c *Client) Put(uri string, msg io.Reader) ([]byte, InteropError) {
	intErr := NewInteropError()

	// set the HTTP method, url, and request body
	req, _ := http.NewRequest(http.MethodPut, c.url+uri, msg)

	// set the request header Content-Type for json
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		intErr.Put = true
		return nil, *intErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != 200 {
		intErr.Put = true
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Debugf("PUT - %s - %d", uri, resp.StatusCode)
	return body, *intErr
}

// Delete makes a DELETE request to the server
func (c *Client) Delete(uri string) ([]byte, InteropError) {
	intErr := NewInteropError()

	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodDelete, c.url+uri, nil)
	resp, err := c.client.Do(req)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		intErr.Delete = true
		return nil, *intErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != 200 {
		intErr.Delete = true
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Debugf("DELETE - %s - %d", uri, resp.StatusCode)
	return body, *intErr
}

// GetTeams gets the statuses of all the teams registered in the server
func (c *Client) GetTeams() ([]TeamStatus, InteropError) {
	data, intErr := c.Get("/api/teams")

	var teams []TeamStatus
	err := json.Unmarshal(data, &teams)

	if err != nil {
		intErr.Output = true
		Log.Error("An error occurred retrieving Team Status information.")
	} else {
		Log.Info("Successfully retrieved Team Status information.")
	}

	return teams, intErr
}

// GetMission gets the mission at the given mission id value
func (c *Client) GetMission(id int32) (*Mission, InteropError) {
	uri := fmt.Sprintf("/api/missions/%d", id)
	data, intErr := c.Get(uri)

	var mission *Mission
	err := json.Unmarshal(data, &mission)

	if err != nil {
		intErr.Output = true
		Log.Error("An error occurred retrieving Mission information.")
	} else {
		Log.Info("Successfully retrieved Mission information.")
	}

	return mission, intErr
}

// PostTelemetry posts the ship's telemetry data to the server
func (c *Client) PostTelemetry(telem *Telemetry) InteropError {
	// Convert telemetry data to json
	telemJSON, _ := json.Marshal(telem)

	// Post telemetry to server
	_, intErr := c.Post("/api/telemetry", bytes.NewReader(telemJSON))

	if intErr.Post {
		Log.Error("An error occurred submitting our Telemetry information")
	} else {
		Log.Info("Successfully submitted our Telemetry information")
	}

	return intErr
}

// GetODLCs gets a list of ODLC objects that have been uploaded. To not limit the
// scope to a certain mission, pass through a negative number to mission.
func (c *Client) GetODLCs(missionID int32) ([]Odlc, InteropError) {
	uri := "/api/odlcs"
	// Specify a specific mission if the caller chooses to
	if missionID > -1 {
		uri += fmt.Sprintf("?mission=%d", missionID)
	}

	// Get request to the server
	data, intErr := c.Get(uri)

	// List to hold all of the ODLC objects we receive
	var odlcList []Odlc
	err := json.Unmarshal(data, &odlcList)

	if err != nil {
		intErr.Output = true
		Log.Error("An error occurred retrieving ODLCs' information.")
	} else {
		Log.Info("Successfully retrieved ODLCs' information")
	}

	return odlcList, intErr
}

// GetODLC gets a single ODLC with the ODLC's id
func (c *Client) GetODLC(id int32) (*Odlc, InteropError) {
	uri := fmt.Sprintf("/api/odlcs/%d", id)

	// Get byte array from the server
	data, intErr := c.Get(uri)

	// Convert byte array into the Odlc object
	var odlc Odlc
	err := json.Unmarshal(data, &odlc)

	if err != nil {
		intErr.Output = true
		Log.Error("An error occurred retrieving an ODLC's information")
	} else {
		Log.Info("Successfully retrieved an ODLC's information")
	}

	return &odlc, intErr
}

// PostODLC posts the ODLC object to the server and then updates the original
// odlc object parameter with the odlc id and the user
func (c *Client) PostODLC(odlc *Odlc) InteropError {
	// Convert ODLC to json format
	odlcJSON, _ := json.Marshal(odlc)

	// Post the json to the server
	updatedODLC, intErr := c.Post("/api/odlcs", bytes.NewReader(odlcJSON))

	// Update the original parameter with the new values passed through
	err := json.Unmarshal(updatedODLC, &odlc)

	if err != nil {
		intErr.Output = true
		Log.Error("An error occurred submitting an ODLC's information")
	} else {
		Log.Info("Successfully submitted an ODLC's information")
	}

	return intErr
}

// PutODLC sends a PUT request to the server, updating any parameters of a
// specific ODLC with the values passed through.
func (c *Client) PutODLC(id int32, odlc *Odlc) InteropError {
	// Convert ODLC to json format
	odlcJSON, _ := json.Marshal(odlc)

	uri := fmt.Sprintf("/api/odlcs/%d", id)

	// Put the json to the server
	updatedODLC, intErr := c.Put(uri, bytes.NewReader(odlcJSON))

	// Update the original parameter with the new values passed through
	err := json.Unmarshal(updatedODLC, &odlc)

	if err != nil {
		intErr.Output = true
		Log.Error("An error occurred updating an ODLC's information")
	} else {
		Log.Info("Successfully updated an ODLC's information")
	}

	return intErr
}

// DeleteODLC deletes the ODLC at the specified id number
func (c *Client) DeleteODLC(id int32) InteropError {
	uri := fmt.Sprintf("/api/odlcs/%d", id)
	_, intErr := c.Delete(uri)

	if intErr.Delete {
		Log.Error("An error occurred deleting an uploaded ODLC")
	} else {
		Log.Info("Successfully deleted an uploaded ODLC")
	}

	return intErr
}

// GetODLCImage gets the raw binary image content of a specified ODLC that has
// already had image data uploaded to the server
func (c *Client) GetODLCImage(id int32) ([]byte, InteropError) {
	uri := fmt.Sprintf("/api/odlcs/%d/image", id)

	body, intErr := c.Get(uri)

	if intErr.Get {
		Log.Error("An error occurred retreiving an ODLC's image")
	} else {
		Log.Info("Successfully retrieved an ODLC's image")
	}

	return body, intErr
}

// PutODLCImage puts the binary image content of the ODLC to the server for the
// specified ODLC id
func (c *Client) PutODLCImage(id int32, image []byte) InteropError {
	uri := fmt.Sprintf("/api/odlcs/%d/image", id)

	_, intErr := c.Put(uri, bytes.NewReader(image))

	if intErr.Put {
		Log.Error("An error occurred submitting an ODLC's image")
	} else {
		Log.Info("Successfully submitted an ODLC's image")
	}

	return intErr
}

// DeleteODLCImage deletes the image saved at the specified ODLC
func (c *Client) DeleteODLCImage(id int32) InteropError {
	uri := fmt.Sprintf("/api/odlcs/%d/image", id)

	_, intErr := c.Delete(uri)

	if intErr.Delete {
		Log.Error("An error occurred deleting an ODLC's image")
	} else {
		Log.Info("Successfully submitted an ODLC's image")
	}

	return intErr
}
