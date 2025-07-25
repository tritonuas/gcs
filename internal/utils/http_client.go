// Package utils provides generic HTTP client helpers used across the backend.
package utils

import (
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"strconv"
	"time"

	"github.com/sirupsen/logrus"
)

// Log is the logger for the http client
var Log = logrus.New()

// Client is a thin wrapper around the standard http.Client that provides
// convenience helpers (GET/POST/etc.) and uniform error handling when
// communicating with other GCS services.
type Client struct {
	client  *http.Client
	urlBase string
	timeout int
}

// IsConnected checks if the client has successfully connected to the specified url via a GET request
func (c *Client) IsConnected() (bool, string) {
	traceRequest, err := http.NewRequest(http.MethodGet, c.urlBase+"/", nil)
	if err != nil {
		return false, err.Error()
	}

	res, err := c.client.Do(traceRequest)
	if err != nil {
		return false, err.Error()
	}

	if res.StatusCode != 200 {
		return false, "ERROR: status code " + strconv.Itoa(res.StatusCode)
	}

	return true, ""
}

// NewClient creates an HTTP client to interact with an HTTP server
// at a specified URL.
func NewClient(urlBase string, timeout int) *Client {
	client := &Client{

		urlBase: "http://" + urlBase,
		timeout: timeout,
	}

	cookieJar, err := cookiejar.New(nil)
	if err != nil {
		Log.Debugf("Could not create client cookie jar. Reason: %s", err)
	}

	client.client = &http.Client{
		Jar:     cookieJar,
		Timeout: time.Duration(timeout) * time.Second,
	}

	return client
}

// Post makes a POST request to the server
func (c *Client) Post(uri string, msg io.Reader) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	resp, err := c.client.Post(c.urlBase+uri, "application/json", msg)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Info(err)
		httpErr.SetError("POST", []byte("Server Offline"), http.StatusBadGateway)
		return nil, *httpErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	errMsg, err := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		if err != nil {
			errMsg = []byte("Unknown error message")
		}

		httpErr.SetError("POST", errMsg, resp.StatusCode)
	}

	defer func() {
		_ = resp.Body.Close()
	}()
	Log.Debugf("Making Request : POST - %s - %d", uri, resp.StatusCode)

	return errMsg, *httpErr
}

// Get makes a GET request to the server
func (c *Client) Get(uri string) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	resp, err := c.client.Get(c.urlBase + uri)

	if err != nil {
		Log.Warn(err)
		httpErr.SetError("GET", []byte("Server Offline"), http.StatusBadGateway)
		return nil, *httpErr
	}

	if resp.StatusCode != http.StatusOK {
		errMsg, err := io.ReadAll(resp.Body)
		if err != nil {
			errMsg = []byte("Unknown error message")
		}
		httpErr.SetError("GET", errMsg, resp.StatusCode)
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	body, resErr := io.ReadAll(resp.Body)
	if resErr != nil {
		Log.Debug(resErr)
	}

	Log.Debugf("Making Request: GET - %s - %d", uri, resp.StatusCode)

	return body, *httpErr
}

// Put makes a PUT request to the server
func (c *Client) Put(uri string, msg io.Reader) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodPut, c.urlBase+uri, msg)
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("PUT", []byte(fmt.Sprintf("Could not create request. Reason: %s", err)), http.StatusInternalServerError)
		return nil, *httpErr
	}

	// set the request header Content-Type for json
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("PUT", []byte("Server Offline"), http.StatusBadGateway)
		return nil, *httpErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	errMsg, err := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		if err != nil {
			errMsg = []byte("Unknown error message")
		}

		httpErr.SetError("PUT", errMsg, resp.StatusCode)
	}

	Log.Debugf("Making Request to: PUT - %s - %d", uri, resp.StatusCode)
	return errMsg, *httpErr
}

// Delete makes a DELETE request to the server
func (c *Client) Delete(uri string) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodDelete, c.urlBase+uri, nil)
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("DELETE", []byte(fmt.Sprintf("Could not create request. Reason: %s", err)), http.StatusInternalServerError)
		return nil, *httpErr
	}

	resp, err := c.client.Do(req)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("DELETE", []byte("Server Offline"), http.StatusBadGateway)
		return nil, *httpErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	errMsg, err := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		if err != nil {
			errMsg = []byte("Unknown error message")
		}

		httpErr.SetError("DELETE", errMsg, resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("DELETE", []byte("Could not read response body"), http.StatusInternalServerError)
		return nil, *httpErr
	}

	Log.Debugf("Making Request to: DELETE - %s - %d", uri, resp.StatusCode)
	return body, *httpErr
}
