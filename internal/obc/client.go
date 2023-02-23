package obc

import (
	"github.com/tritonuas/hub/internal/utils"
)

type Client struct {
	httpClient *utils.Client
	urlBase    string
	timeout    int
}

func NewClient(urlBase string, timeout int) *Client {
	client := &Client{

		url:     "http://" + urlBase,
		timeout: timeout,
	}

	// setup http_client
	client.httpClient = utils.NewClient(urlBase, timeout)

	return client
}