package influxdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
	"github.com/sirupsen/logrus"
)

// connRefreshTimer is the number of seconds Hub will wait until attempting to reconnect to InfluxDB
const connRefreshTimer int = 2

// Log is the logger instace for the influxdb client
var Log = logrus.New()

var errInluxDBNotConnected = errors.New("not connected to InfluxDB")

// var ErrNoInfluxMsgId = errors.New("no with data with the requested message id exists")
// var ErrNoInfluxMsgName = errors.New("no with data with the requested message name exists")

// InfluxCredentials holds various data that is needed to connect to InfluxDB and query/write data
type InfluxCredentials struct {
	Token  string
	Bucket string
	Org    string
	URI    string
}

// Client contains functions to connect, query and write to an InfluxDB instance.
// Essentially a wrapper around the InfluxDB Go Client for convenience and ease of use.
// Original client can be found here https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2
type Client struct {
	creds     InfluxCredentials
	connected bool
	writer    api.WriteAPI
	querier   api.QueryAPI
}

// New creates a new InfluxDB client and attempts to connect
// to an InfluxDB instance. Verifies the connection in the background
// and will not block if establishing a connection takes a while.
func New(creds InfluxCredentials) *Client {
	c := &Client{}

	c.creds = creds

	client := influxdb2.NewClient(creds.URI, creds.Token)
	c.writer = client.WriteAPI(creds.Org, creds.Bucket)
	c.querier = client.QueryAPI(creds.Org)

	// spawn a goroutine to prevent the current goroutine
	// from hanging if InfluxDB isn't setup with the correct credentials yet
	go c.verifyConnection()

	return c
}

// IsConnected returns if the client is connected to InfluxDB
func (c *Client) IsConnected() bool {
	return c.connected
}

func (c *Client) Write(msgName string, msgID uint32, data map[string]interface{}) error {
	if !c.IsConnected() {
		return errInluxDBNotConnected
	}

	for k, v := range data {
		p := influxdb2.NewPointWithMeasurement(msgName).
			AddTag("ID", fmt.Sprintf("%v", msgID)).
			AddField(k, v).
			SetTime(time.Now())
		c.writer.WritePoint(p)
	}
	c.writer.Flush()

	return nil
}

// QueryMsgID will request all the fields for the Mavlink message with the specified ID.
// A full list of mavlink message IDs can be found here http://mavlink.io/en/messages/common.html
//
// Each message has an ID associated with it. For example, the message named "GLOBAL_POSITION_INT" has
// an ID of 33.
//
// Parameters:
//   - msgID: ID number of the message ID to query
//   - timeRange: How far back in the history to query. If 0, then the
//     latest message will be queried. Note that the type is time.Duration so
//     if you wanted to query the past five minutes you would provide 5 * time.Minute
//     as the argument.
//
// Return:
//   - map[string]interface{}: map where keys are field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgID(msgID uint32, timeRange time.Duration) (map[string]interface{}, error) {
	return c.QueryMsgIDAndFields(msgID, timeRange)
}

// QueryMsgName will request all the fields for the Mavlink message with the specified name.
// A full list of mavlink message names can be found here http://mavlink.io/en/messages/common.html
//
// Each message has an name associated with it. For example, the message of ID #33 is named
// "GLOBAL_POSITION_INT"
//
// Parameters:
//   - msgName: Name of the Mavlink message to query
//   - timeRange: How far back in the history to query. If 0, then the
//     latest message will be queried. Note that the type is time.Duration so
//     if you wanted to query the past five minutes you would provide 5 * time.Minute
//     as the argument.
//
// Return:
//   - map[string]interface{}: map where keys are field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgName(msgName string, timeRange time.Duration) (map[string]interface{}, error) {
	return c.QueryMsgNameAndFields(msgName, timeRange)
}

// QueryMsgIDAndFields will request certain fields for the Mavlink message with the specified ID.
// A full list of mavlink message IDs and their fields can be found here http://mavlink.io/en/messages/common.html
//
// Each message has an ID associated with it. For example, the message named "GLOBAL_POSITION_INT" has
// an ID of 33.
//
// Each message also has various fields included in it. For example, the message named "GLOBAL_POSITION_INT" has the
// following fields: "time_boot_ms", "lat", "lon", "alt", "relative_alt", "vx", "vy", "vz".
//
// Parameters:
//   - msgID: ID number of the message ID to query
//   - timeRange: How far back in the history to query. If 0, then the
//     latest message will be queried. Note that the type is time.Duration so
//     if you wanted to query the past five minutes you would provide 5 * time.Minute
//     as the argument.
//   - fields: variadic parameter that will take in any number of field name strings.
//
// Return:
//   - map[string]interface{}: map where keys are field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgIDAndFields(msgID uint32, timeRange time.Duration, fields ...string) (map[string]interface{}, error) {
	if !c.IsConnected() {
		return nil, errInluxDBNotConnected
	}

	query := c.makeQuery(timeRange, &msgID, nil, fields...)

	result, err := c.querier.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}

	data := make(map[string]interface{})
	for result.Next() {
		data[result.Record().Field()] = result.Record().Value()
	}

	return data, nil
}

// QueryMsgNameAndFields will request certain fields for the Mavlink message with the specified name.
// A full list of mavlink message IDs and their fields can be found here http://mavlink.io/en/messages/common.html
//
// Each message has an name associated with it. For example, the message of ID #33 is named
// "GLOBAL_POSITION_INT"
//
// Each message also has various fields included in it. For example, the message named "GLOBAL_POSITION_INT" has the
// following fields: "time_boot_ms", "lat", "lon", "alt", "relative_alt", "vx", "vy", "vz".
//
// Parameters:
//   - msgName: Name of the Mavlink message to query
//   - timeRange: How far back in the history to query. If 0, then the
//     latest message will be queried. Note that the type is time.Duration so
//     if you wanted to query the past five minutes you would provide 5 * time.Minute
//     as the argument.
//   - fields: variadic parameter that will take in any number of field name strings.
//
// Return:
//   - map[string]interface{}: map where keys are field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgNameAndFields(msgName string, timeRange time.Duration, fields ...string) (map[string]interface{}, error) {
	if !c.IsConnected() {
		return nil, errInluxDBNotConnected
	}
	query := c.makeQuery(timeRange, nil, &msgName, fields...)

	result, err := c.querier.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}

	data := make(map[string]interface{})
	for result.Next() {
		data[result.Record().Field()] = result.Record().Value()
	}

	return data, nil
}

// TODO: Will dump entire DB to a JSON or CSV format
func (c *Client) GetAll() (string, error) {
	if !c.IsConnected() {
		return "", errInluxDBNotConnected
	}

	return "", nil
}

// verifyConnection will try to query that InluxDB has started up and
// has been setup with the correct credentials
func (c *Client) verifyConnection() {
	startTime := time.Now()
	for {
		// send a dummy query to message ID 33 (plane position) which should exist if we are connected to the plane
		_, err := c.querier.Query(
			context.Background(),
			fmt.Sprintf(`from(bucket:"%s")|> range(start: -1h) |> filter(fn: (r) => r.ID == "33")`,
				c.creds.Bucket))
		if err == nil {
			break
		}
		Log.Errorf("Connection to InfluxDB failed. Trying again in %d seconds.", connRefreshTimer)
		time.Sleep(time.Duration(connRefreshTimer) * time.Second)
	}
	c.connected = true
	Log.Infof("Successfully connected to InfluxDB at %s in %f seconds", c.creds.URI, time.Since(startTime).Seconds())
}

// makeQuery will create a query string to be used to query InfluxDB. The
// query string is written with the flux scripting language. For references
// to flux functions and datatypes, see here https://docs.influxdata.com/flux/v0.x/
//
// Parameters:
//
//   - timeRange: How far back in the history to query. If 0, then the
//     latest message will be queried. Note that the type is time.Duration so
//     if you wanted to query the past five minutes you would provide 5 * time.Minute
//     as the argument.
//
//   - msgID: pointer to a message ID to query. Provide nil if you don't want to filter
//     messages by their ID
//
//   - msgName: pointer to a message name to query. Provide nil if you don't want to filter
//     messages by their name
//
// Return:
//   - query string to be used by Influxdb queryAPI
func (c *Client) makeQuery(timeRange time.Duration, msgID *uint32, msgName *string, fields ...string) string {
	query := fmt.Sprintf(`from(bucket:"%s")`, c.creds.Bucket)
	if timeRange == 0 {
		query += "|> range(start: -1d)"
	} else {
		query += fmt.Sprintf("|> range(start: -duration(v: %d))", timeRange.Abs().Nanoseconds())
	}
	if msgID != nil {
		query += fmt.Sprintf(`|> filter(fn: (r) => r.ID == "%v")`, *msgID)
	} else if msgName != nil {
		query += fmt.Sprintf(`|> filter(fn: (r) => r._measurement == "%s")`, *msgName)
	}

	// Note that this result will contain a single mavlink message (with its fields) since the
	// following code cuts off everything except the first/last result.

	// If a timeRange of 0 is provided then we want to query the latest message. If not then
	// we want the first message from the time specified.
	if timeRange == 0 {
		query += "|> last()"
	} else {
		query += "|> first()"
	}

	for i, field := range fields {
		if i == 0 {
			query += "|> filter(fn: (r) => "
		}

		query += fmt.Sprintf(`r._field == "%s"`, field)

		if i == len(fields)-1 {
			query += ")"
		} else {
			query += " or "
		}
	}

	return query
}