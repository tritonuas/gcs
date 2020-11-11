/*
Core interoperability client module

This module provides a Go interface to the SUAS interoperability API.
This module is designed to mimic the official python interface found
here: https://github.com/auvsi-suas/interop/blob/master/client/auvsi_suas/client/client.py
*/
package interopconn

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"strconv"

	"github.com/sirupsen/logrus"
)

var Log = logrus.New()

type Client struct {
	client   *http.Client
	url      string
	username string
	password string
	// timeout int `default:10`
	// max_concurrent int `default:128`
	// max_retries int `default:10`
}

// NewClient creates creates an instance of the interop Client struct
// to make requests with the interop server.
// func NewClient(url string, username string, password string, timeout int, max_concurrent int, max_retries int) *Client{
func NewClient(url string, username string, password string) (*Client, InteropError) {
	client := &Client{
		url:      "http://" + url,
		username: username,
		password: password,
		// timeout: timeout,
		// max_concurrent: max_concurrent,
		// max_retries: max_retries,
	}

	// setup client with cookies
	Log.Info("Creating Interop Client connected to: ", url)
	cookieJar, _ := cookiejar.New(nil)
	client.client = &http.Client{
		Jar: cookieJar,
	}

	// jsonify authentication
	auth := map[string]string{"username": username, "password": password}
	auth_json, _ := json.Marshal(auth)

	// All endpoints are authenticated, so always login
	_, intErr := client.Post("/api/login", bytes.NewBuffer(auth_json))

	return client, intErr
}

// Get makes a GET request to server.
func (c *Client) Get(uri string) ([]byte, InteropError) {
	intErr := NewInteropError()

	Log.Debug(c.url + uri)
	resp, err := c.client.Get(c.url + uri)

	// We have to also check the status code because for some reason the Get
	// function only will return an error object on 2xx error codes, so to catch
	// a 4xx error we need to check the status code directly
	if err != nil || resp.StatusCode != 200 {
		intErr.get = true
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("GET - "+uri+" - ", resp.StatusCode)
	Log.Debug(string(body))

	return body, *intErr
}

// Post makes a POST request to server.
func (c *Client) Post(uri string, msg io.Reader) ([]byte, InteropError) {
	intErr := NewInteropError()

	Log.Debug(c.url + uri)
	resp, err := c.client.Post(c.url+uri, "application/json", msg)

	if err != nil || resp.StatusCode != 200 {
		intErr.post = true
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("POST - "+uri+" - ", resp.StatusCode)

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
	if err != nil || resp.StatusCode != 200 {
		intErr.put = true
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("PUT - "+uri+" - ", resp.StatusCode)
	return body, *intErr
}

// Delete makes a DELETE request to the server
func (c *Client) Delete(uri string) ([]byte, InteropError) {
	intErr := NewInteropError()

	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodDelete, c.url+uri, nil)

	resp, err := c.client.Do(req)
	if err != nil || resp.StatusCode != 200 {
		intErr.delete = true
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("DELETE- "+uri+" - ", resp.StatusCode)
	return body, *intErr
}

// GetTeams gets the statuses of all the teams registered in the server
func (c *Client) GetTeams() ([]TeamStatus, InteropError) {
	data, intErr := c.Get("/api/teams")

	var teams []TeamStatus
	err := json.Unmarshal(data, &teams)

	if err != nil {
		intErr.output = true
	}

	return teams, intErr
}

// GetMission gets the mission at the given mission id value
func (c *Client) GetMission(id int) (*Mission, InteropError) {
	data, intErr := c.Get("/api/missions/" + strconv.Itoa(id))

	var mission *Mission
	err := json.Unmarshal(data, &mission)

	if err != nil {
		intErr.output = true
	}

	return mission, intErr
}

// PostTelemetry posts the ship's telemetry data to the server
func (c *Client) PostTelemetry(telem *Telemetry) InteropError {
	// Convert telemetry data to json
	telemJSON, _ := json.Marshal(telem)

	// Post telemetry to server
	_, intErr := c.Post("/api/telemetry", bytes.NewReader(telemJSON))

	return intErr
}

// GetODLCs gets a list of ODLC objects that have been uploaded. To not limit the
// scope to a certain mission, pass through a negative number to mission.
func (c *Client) GetODLCs(mission int) ([]Odlc, InteropError) {
	url := "/api/odlcs"
	// Specify a specific mission if the caller chooses to
	if mission > -1 {
		url += "?mission=" + strconv.Itoa(mission)
	}

	// Get request to the server
	data, intErr := c.Get(url)

	// List to hold all of the ODLC objects we receive
	var odlcList []Odlc
	err := json.Unmarshal(data, &odlcList)

	if err != nil {
		intErr.output = true
	}

	return odlcList, intErr
}

// GetODLC gets a single ODLC with the ODLC's id
func (c *Client) GetODLC(id int) (*Odlc, InteropError) {
	url := "/api/odlcs/" + strconv.Itoa(id)

	// Get byte array from the server
	data, intErr := c.Get(url)

	// Convert byte array into the Odlc object
	var odlc Odlc
	err := json.Unmarshal(data, &odlc)

	if err != nil {
		intErr.output = true
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
		intErr.output = true
	}

	return intErr
}

// PutODLC sends a PUT request to the server, updating any parameters of a
// specific ODLC with the values passed through.
func (c *Client) PutODLC(id int, odlc *Odlc) InteropError {
	// Convert ODLC to json format
	odlcJSON, _ := json.Marshal(odlc)

	url := "/api/odlcs/" + strconv.Itoa(id)

	// Put the json to the server
	updatedODLC, intErr := c.Put(url, bytes.NewReader(odlcJSON))

	// Update the original parameter with the new values passed through
	err := json.Unmarshal(updatedODLC, &odlc)

	if err != nil {
		intErr.output = true
	}

	return intErr
}

// DeleteODLC deletes the ODLC at the specified id number
func (c *Client) DeleteODLC(id int) InteropError {
	url := "/api/odlcs/" + strconv.Itoa(id)
	_, intErr := c.Delete(url)

	return intErr
}

// GetODLCImage gets the raw binary image content of a specified ODLC that has
// already had image data uploaded to the server
func (c *Client) GetODLCImage(id int) ([]byte, InteropError) {
	url := "/api/odlcs/" + strconv.Itoa(id) + "/image"

	body, intErr := c.Get(url)

	return body, intErr
}

// PostODLCImage is equivalent to PutODLCImage`
func (c *Client) PostODLCImage(id int, data []byte) InteropError {
	return c.PutODLCImage(id, data)
}

// PutODLCImage puts the binary image content of the ODLC to the server for the
// specified ODLC id
func (c *Client) PutODLCImage(id int, image []byte) InteropError {
	url := "/api/odlcs/" + strconv.Itoa(id) + "/image"

	_, intErr := c.Put(url, bytes.NewReader(image))

	return intErr
}

// DeleteODLCImage deletes the image saved at the specified ODLC
func (c *Client) DeleteODLCImage(id int) InteropError {
	url := "/api/odlcs/" + strconv.Itoa(id) + "/image"

	_, intErr := c.Delete(url)

	return intErr
}
