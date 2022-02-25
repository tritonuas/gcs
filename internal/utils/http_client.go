package utils 

import (
	"io"
	"io/ioutil"
	"net/http"
	"net/http/cookiejar"
	"time"

	"github.com/sirupsen/logrus"
)

var Log = logrus.New()

/*
Notes to myself: Figured out pretty much how I'm going to develop inhertiance fo the
lower level HTTP requests, I have the functions copied to this struct right now, just
need to edit Put and Delete to account for the syntax of the error struct in here.
The way I'm going to develop inheritance is most likely going to be by composition, by having
this client referenced in each client, then having their methods called,sort of like 
how *http.Client is created in here, though I think we don't even need that in the other
ones which seems interesting.
*/

//change name of Client since it might mess with the inheritance for the other clients
type Client struct {
	client  *http.Client
	url     string
	timeout int
}

func (c *Client) IsConnected() bool {
	return c.client != nil
}

func NewClient(url string, timeout int) *Client {
	client := &Client{

		url:     "http://" + url,
		timeout: timeout,
	}

	cookieJar, _ := cookiejar.New(nil)
	client.client = &http.Client{
		Jar:     cookieJar,
		Timeout: time.Duration(timeout) * time.Second,
	}

	return client
}

//TODO - find a wway to rename the outputed strings to not be specific to a server but generalized, or have a way for
//the clients to properly account for them

//Post makes a POST request to the server
func (c *Client) Post(uri string, msg io.Reader) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	resp, err := c.client.Post(c.url+uri, "application/json", msg)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("POST", []byte(err.Error()), http.StatusBadGateway)
		return nil, *httpErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != http.StatusOK {
		errMsg, _ := ioutil.ReadAll(resp.Body)
		httpErr.SetError("POST", errMsg, resp.StatusCode)
	}

	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	Log.Debugf("Making Request to RTPP: POST - %s - %d", uri, resp.StatusCode)

	return body, *httpErr
}

//Get makes a GET request to the server
func (c *Client) Get(uri string) ([]byte, HTTPError){
	httpErr := NewHTTPError()

	resp, err := c.client.Get(c.url+uri)
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("GET", []byte(err.Error()), http.StatusBadGateway)
		return nil, *httpErr
	}
	if resp.StatusCode != http.StatusOK {
		errMsg, _ := ioutil.ReadAll(resp.Body)
		httpErr.SetError("GET", errMsg, resp.StatusCode)
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	Log.Debugf("Making Request to RTPP: GET - %s - %d", uri, resp.StatusCode)

	return body, *httpErr
}

// Put makes a PUT request to the server
func (c *Client) Put(uri string, msg io.Reader) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	// set the HTTP method, url, and request body
	req, _ := http.NewRequest(http.MethodPut, c.url+uri, msg)

	// set the request header Content-Type for json
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.client.Do(req)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("PUT", []byte(err.Error()), http.StatusBadGateway)
		return nil, *httpErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != http.StatusOK {
		errMsg, _ := ioutil.ReadAll(resp.Body)
		httpErr.SetError("PUT", errMsg, resp.StatusCode)
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Debugf("Making Request to Interop: PUT - %s - %d", uri, resp.StatusCode)
	return body, *httpErr
}

// Delete makes a DELETE request to the server
func (c *Client) Delete(uri string) ([]byte, HTTPError) {
	httpErr := NewHTTPError()

	// set the HTTP method, url, and request body
	req, err := http.NewRequest(http.MethodDelete, c.url+uri, nil)
	resp, err := c.client.Do(req)

	// If err is not nil, then the server is not online and we need to back out
	// so that nothing crashes
	if err != nil {
		Log.Debug(err)
		httpErr.SetError("DELETE", []byte(err.Error()), http.StatusBadGateway)
		return nil, *httpErr
	}

	// The server is online, but we need to check the status code directly to
	// see if there was a 4xx error
	if resp.StatusCode != 200 {
		errMsg, _ := ioutil.ReadAll(resp.Body)
		httpErr.SetError("DELETE", errMsg, resp.StatusCode)
	}

	body, _ := ioutil.ReadAll(resp.Body)

	Log.Debugf("Making Request to Interop: DELETE - %s - %d", uri, resp.StatusCode)
	return body, *httpErr
}