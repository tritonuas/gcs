package obc

import (
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