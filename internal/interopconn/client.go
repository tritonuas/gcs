/*
Core interoperability client module

This module provides a Go interface to the SUAS interoperability API.
This module is designed to mimic the official python interface found
here: https://github.com/auvsi-suas/interop/blob/master/client/auvsi_suas/client/client.py
*/
package interopconn;

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"

	"github.com/sirupsen/logrus"
)

var Log = logrus.New()

type Client struct {
	client *http.Client
	url string
	username string
	password string
	// timeout int `default:10`
	// max_concurrent int `default:128`
	// max_retries int `default:10`
}

// NewClient creates creates an instance of the interop Client struct
// to make requests with the interop server.
// func NewClient(url string, username string, password string, timeout int, max_concurrent int, max_retries int) *Client{
func NewClient(url string, username string, password string) *Client{
	client := &Client{
		url: "http://" + url,
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
	client.Post("/api/login", bytes.NewBuffer(auth_json))

	return client
}


// Get makes a GET request to server.
func (c *Client) Get(uri string) ([]byte, error){
	Log.Debug(c.url + uri)
	resp, err := c.client.Get(c.url + uri)

	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: REPLACE THIS GET ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("GET - " + uri + " - ", resp.StatusCode)
	Log.Debug(string(body))

	return body, nil
}

// Post makes a POST request to server.
func (c *Client) Post(uri string, msg io.Reader) ([]byte, error){
	Log.Debug(c.url + uri)
	resp, err := c.client.Post(c.url + uri, "application/json", msg)

	if err != nil {
		// custom error struct to handle interop error
		Log.Error("TODO: Replace this POST ERROR")
		return []byte("-1"), errors.New("TODO: Replace this error")
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)

	Log.Info("POST - " + uri + " - ", resp.StatusCode)

	return body, nil
}

// TODO: all of this stuff with actually methods that work
func (c *Client) Put(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) Delete(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) GetTeams(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) GetMission(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) PostTelemetry(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) GetODLCs(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) GetODLC(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) PutODLC(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) DeleteODLC(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) GetODLCImage(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) PostODLCImage(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) PutODLCImage(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
func (c *Client) DeleteODLCImage(uri string) ([]byte, error){
	return []byte("-1"), errors.New("TODO")
}
