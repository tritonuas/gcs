package obc

import (
	"bytes"
	"encoding/gob"

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
*/
func (client *Client) PostMission(mission *pp.Mission) error {
	var err error
	var b bytes.Buffer
	enc := gob.NewEncoder(&b)
	err = enc.Encode(mission)

	if err != nil {
		return err
	}

	client.httpClient.Post("/mission", bytes.NewReader(b.Bytes())) // idk if this is right

	return err
}

//wrap httpClient function
func (client *Client) IsConnected() (bool, string) {
	return client.httpClient.IsConnected()
}
