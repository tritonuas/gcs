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
	"errors"
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
func NewClient(url string, username string, password string) (*Client, error) {
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
	_, err := client.Post("/api/login", bytes.NewBuffer(auth_json))

	return client, err
}

// Get makes a GET request to server.
func (c *Client) Get(uri string) ([]byte, error) {
	Log.Debug(c.url + uri)
	resp, err := c.client.Get(c.url + uri)

	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: REPLACE THIS GET ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("GET - "+uri+" - ", resp.StatusCode)
	Log.Debug(string(body))

	return body, nil
}

// Post makes a POST request to server.
func (c *Client) Post(uri string, msg io.Reader) ([]byte, error) {
	Log.Debug(c.url + uri)
	resp, err := c.client.Post(c.url+uri, "application/json", msg)

	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: Replace this POST ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("POST - "+uri+" - ", resp.StatusCode)

	return body, nil
}

// Put makes a PUT request to the server
func (c *Client) Put(uri string, msg io.Reader) ([]byte, error) {
	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodPut, c.url+uri, msg)
	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: Replace this PUT ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	// set the request header Content-Type for json
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: Replace this (2nd) PUT ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("PUT - "+uri+" - ", resp.StatusCode)
	return body, nil
}

// Delete makes a DELETE request to the server
func (c *Client) Delete(uri string) ([]byte, error) {
	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodDelete, c.url+uri, nil)
	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: Replace this DELETE ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	resp, err := c.client.Do(req)
	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: Replace this (2nd) DELETE ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("DELETE- "+uri+" - ", resp.StatusCode)
	return body, nil
}

// GetTeams gets the statuses of all the teams registered in the server
func (c *Client) GetTeams() ([]TeamStatus, error) {
	data, err := c.Get("/api/teams")

	if err != nil {
		Log.Error("ERROR in GetTeams() in c.Get:")
		Log.Error(err)
		return nil, err
	}

	var teams []TeamStatus
	err = json.Unmarshal(data, &teams)

	if err != nil {
		Log.Error("ERROR in GetTeams() in json.Unmarshal:")
		Log.Error(err)
	}

	return teams, err
}

// GetMission gets the mission at the given mission id value
func (c *Client) GetMission(id int) (*Mission, error) {
	data, err := c.Get("/api/missions/" + strconv.Itoa(id))

	if err != nil {
		Log.Error("ERROR in GetMission(int) in c.Get:")
		Log.Error(err)
		return nil, err
	}

	var mission *Mission
	err = json.Unmarshal(data, &mission)

	if err != nil {
		Log.Error("ERROR in GetMission(int) in json.Unmarshal:")
		Log.Error(err)
	}

	return mission, err
}

// PostTelemetry posts the ship's telemetry data to the server
func (c *Client) PostTelemetry(telem *Telemetry) error {
	// Convert telemetry data to json
	telemJSON, err := json.Marshal(telem)

	if err != nil {
		Log.Error("ERROR in PostTelemetry(*Telemetry) in json.Marshal:")
		Log.Error(err)
		return err
	}

	// Post telemetry to server
	_, err = c.Post("/api/telemetry", bytes.NewReader(telemJSON))

	if err != nil {
		Log.Error("ERROR in PostTelemtry(*Telemetry) in c.Post:")
		Log.Error(err)
	}

	return err
}

// GetODLCs gets a list of ODLC objects that have been uploaded. To not limit the
// scope to a certain mission, pass through a negative number to mission.
func (c *Client) GetODLCs(mission int) ([]Odlc, error) {
	url := "/api/odlcs"
	// Specify a specific mission if the caller chooses to
	if mission > -1 {
		url += "?mission=" + strconv.Itoa(mission)
	}

	// Get request to the server
	data, err := c.Get(url)

	if err != nil {
		Log.Error("ERROR in GetODLCs(int) in c.Get:")
		Log.Error(err)
		return nil, err
	}

	// List to hold all of the ODLC objects we receive
	var odlcList []Odlc
	err = json.Unmarshal(data, &odlcList)

	if err != nil {
		Log.Error("ERROR in GetODLCs(int) in json.Unmarshal")
		Log.Error(err)
		return nil, err
	}

	return odlcList, err
}

// GetODLC gets a single ODLC with the ODLC's id
func (c *Client) GetODLC(id int) *Odlc {
	url := "/api/odlcs/" + strconv.Itoa(id)

	// Get byte array from the server
	data, err := c.Get(url)

	if err != nil {
		Log.Error("ERROR in GetODLC(int) in c.Get:")
		Log.Error(err)
	}

	// Convert byte array into the Odlc object
	var odlc Odlc
	err = json.Unmarshal(data, &odlc)

	if err != nil {
		Log.Error("ERROR in GETODLC(int) in json.Unmarshal")
		Log.Error(err)
		return nil, err
	}

	return &odlc
}

// PostODLC posts the ODLC object to the server and then updates the original
// odlc object parameter with the odlc id and the user
func (c *Client) PostODLC(odlc *Odlc) error {
	// Convert ODLC to json format
	odlcJSON, err := json.Marshal(odlc)

	if err != nil {
		Log.Error("ERROR in PostODLC(*Odlc) in json.Marshal:")
		Log.Error(err)
		return err
	}

	// Post the json to the server
	updatedODLC, err := c.Post("/api/odlcs", bytes.NewReader(odlcJSON))

	if err != nil {
		Log.Error("ERROR in PostODLC(*Odlc) in c.Post:")
		Log.Error(err)
		return err
	}

	// Update the original parameter with the new values passed through
	err = json.Unmarshal(updatedODLC, &odlc)

	if err != nil {
		Log.Error("ERROR in PostODLC(*Odlc) in json.Unmarshal:")
		Log.Error(err)
	}

	return err
}

// PutODLC sends a PUT request to the server, updating any parameters of a
// specific ODLC with the values passed through.
func (c *Client) PutODLC(id int, odlc *Odlc) error {
	// Convert ODLC to json format
	odlcJSON, err := json.Marshal(odlc)

	if err != nil {
		Log.Error("ERROR in PutODLC(int, *Odlc) in json.Marshal:")
		Log.Error(err)
		return err
	}

	url := "/api/odlcs/" + strconv.Itoa(id)

	// Put the json to the server
	updatedODLC, err := c.Put(url, bytes.NewReader(odlcJSON))

	if err != nil {
		Log.Error("ERROR in PutODLC(int, *ODlc) in c.Put:")
		Log.Error(err)
		return err
	}

	// Update the original parameter with the new values passed through
	err = json.Unmarshal(updatedODLC, &odlc)

	if err != nil {
		Log.Error("ERROR in PutOdlc(int, *Odlc) in json.Unmarshal:")
		Log.Error(err)
	}

	return err
}

// DeleteODLC deletes the ODLC at the specified id number
func (c *Client) DeleteODLC(id int) error {
	url := "/api/odlcs/" + strconv.Itoa(id)
	_, err := c.Delete(url)

	if err != nil {
		Log.Error("ERROR in DeleteODLC in c.Delete:")
		Log.Error(err)
	}

	return err
}

// GetODLCImage gets the raw binary image content of a specified ODLC that has
// already had image data uploaded to the server
func (c *Client) GetODLCImage(id int) ([]byte, error) {
	url := "/api/odlcs/" + strconv.Itoa(id) + "/image"

	body, err := c.Get(url)

	if err != nil {
		Log.Error("ERROR in GetODLCImage(int) in c.Get:")
		Log.Error(err)
	}

	return body, err
}

// PostODLCImage is equivalent to PutODLCImage`
func (c *Client) PostODLCImage(id int, data []byte) error {
	return c.PutODLCImage(id, data)
}

// PutODLCImage puts the binary image content of the ODLC to the server for the
// specified ODLC id
func (c *Client) PutODLCImage(id int, image []byte) error {
	url := "/api/odlcs/" + strconv.Itoa(id) + "/image"

	_, err := c.Put(url, bytes.NewReader(image))

	if err != nil {
		Log.Error("ERROR in PutODLCImage(int, []byte) in c.Put:")
		Log.Error(err)
	}

	return err
}

// DeleteODLCImage deletes the image saved at the specified ODLC
func (c *Client) DeleteODLCImage(id int) error {
	url := "/api/odlcs/" + strconv.Itoa(id) + "/image"

	_, err := c.Delete(url)

	if err != nil {
		Log.Error("ERROR in DeleteODLCImage(int) in c.Delete:")
		Log.Error(err)
	}

	return err
}
