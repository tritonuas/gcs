package influxdb

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
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

// Credentials holds various data that is needed to connect to InfluxDB and query/write data
type Credentials struct {
	Token  string
	Bucket string
	Org    string
	URI    string
}

// Client contains functions to connect, query and write to an InfluxDB instance.
// Essentially a wrapper around the InfluxDB Go Client for convenience and ease of use.
// Original client can be found here https://pkg.go.dev/github.com/influxdata/influxdb-client-go/v2
type Client struct {
	creds     Credentials
	connected bool
	writer    api.WriteAPI
	querier   api.QueryAPI
}

// New creates a new InfluxDB client and attempts to connect
// to an InfluxDB instance. Verifies the connection in the background
// and will not block if establishing a connection takes a while.
func New(creds Credentials) *Client {
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

// Write will write a mavlink message to InfluxDB.
//
// A full list of mavlink message names and IDs can be found here
// http://mavlink.io/en/messages/common.html
//
// Parameters:
//   - msgName: Mavlink message name. ex: "GLOBAL_POSITION_INT"
//   - msgID: Mavlink message ID number. ex: 33 for message named "GLOBAL_POSITION_INT"
//   - data: map that holds mavlink message fields and their values. For example, the message
//     named "GLOBAL_POSITION_INT" has a field called "alt" with a value such as 22860.
func (c *Client) Write(msgName string, msgID uint32, data map[string]interface{}) error {
	if !c.IsConnected() {
		return errInluxDBNotConnected
	}
	p := influxdb2.NewPointWithMeasurement(msgName).
		AddTag("ID", fmt.Sprintf("%v", msgID)).
		SetTime(time.Now())

	// add all fields to the same point
	for field, value := range data {
		p.AddField(field, value)
	}

	c.writer.WritePoint(p)
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
//   - []map[string]interface{}: list of maps. each map has keys as field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgID(msgID uint32, timeRange time.Duration) ([]map[string]interface{}, error) {
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
//   - []map[string]interface{}: list of maps. each map has keys as field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgName(msgName string, timeRange time.Duration) ([]map[string]interface{}, error) {
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
//   - []map[string]interface{}: list of maps. each map has keys as field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgIDAndFields(msgID uint32, timeRange time.Duration, fields ...string) ([]map[string]interface{}, error) {
	if !c.IsConnected() {
		return nil, errInluxDBNotConnected
	}

	query := c.makeQuery(timeRange, &msgID, nil, fields...)

	result, err := c.querier.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}

	data := make([]map[string]interface{}, 0)
	for result.Next() {
		// see if message with timestamp already exists
		idx := -1
		for i, msg := range data {
			if time, ok := msg["_time"]; ok && time == result.Record().Time().String() {
				idx = i
			}
		}

		if idx == -1 {
			data = append(data, make(map[string]interface{}))
			idx = len(data) - 1
		}
		data[idx][result.Record().Field()] = result.Record().Value()
		data[idx]["_time"] = result.Record().Time().String()
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
//   - []map[string]interface{}: list of maps. each map has keys as field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgNameAndFields(msgName string, timeRange time.Duration, fields ...string) ([]map[string]interface{}, error) {
	if !c.IsConnected() {
		return nil, errInluxDBNotConnected
	}
	query := c.makeQuery(timeRange, nil, &msgName, fields...)

	result, err := c.querier.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}

	data := make([]map[string]interface{}, 0)
	for result.Next() {
		// see if message with timestamp already exists
		idx := -1
		for i, msg := range data {
			if time, ok := msg["_time"]; ok && time == result.Record().Time().String() {
				idx = i
			}
		}

		if idx == -1 {
			data = append(data, make(map[string]interface{}))
			idx = len(data) - 1
		}
		data[idx][result.Record().Field()] = result.Record().Value()
		data[idx]["_time"] = result.Record().Time().String()
	}
	return data, nil
}

// TODO: Will dump entire DB to a JSON or CSV format
func (c *Client) GetAll() (string, error) {

	const fileWriterErrMsg = "File writer fail to write"

	endTime := time.Now().Format(time.RFC3339)
	timeStamp := time.Now().Format("2006-01-02 15:04:05")

	attitude, attitudeError := c.QueryMsgIDAndTimeRange(uint32(30), &endTime)
	battery, batteryError := c.QueryMsgIDAndTimeRange(uint32(147), &endTime)
	globalPosition, globalPositionError := c.QueryMsgIDAndTimeRange(uint32(33), &endTime)
	heartbeat, heartbeatError := c.QueryMsgIDAndTimeRange(uint32(0), &endTime)
	vfrhud, vfrhudError := c.QueryMsgIDAndTimeRange(uint32(74), &endTime)

	fields := make([]map[string]interface{}, 0)

	fields = append(fields, (map[string]interface{}{
		"query": attitude, // Replace with the appropriate value
		"name":  "ATTITUDE",
		"error": attitudeError,
	}))

	fields = append(fields, (map[string]interface{}{
		"query": battery,
		"name":  "BATTERY_STATUS",
		"error": batteryError,
	}))

	fields = append(fields, (map[string]interface{}{
		"query": globalPosition,
		"name":  "GLOBAL_POSITION_INT",
		"error": globalPositionError,
	}))

	fields = append(fields, (map[string]interface{}{
		"query": heartbeat,
		"name":  "HEARTBEAT",
		"error": heartbeatError,
	}))

	fields = append(fields, (map[string]interface{}{
		"query": vfrhud,
		"name":  "VFR_HUD",
		"error": vfrhudError,
	}))

	mkDirErr := os.Mkdir("/CSV/"+timeStamp, 0700)

	if mkDirErr != nil {
		return "Error in making directory", mkDirErr
	}

	for x := 0; x < len(fields); x++ {
		queryMap := fields[x]["query"].([]map[string]interface{})
		name := fields[x]["name"].(string)
		queryErr := fields[x]["error"]

		file, err := os.Create("/CSV/" + timeStamp + "/" + name + ".csv")

		if err != nil {
			file.Close()
			return "Fail to create new CSV file", err
		}

		if queryErr != nil {
			_, err = file.WriteString("Query for " + name + " not working")
			if err != nil {
				return fileWriterErrMsg, err
			}
			return "Query for " + name + " not working", queryErr.(error)
		}

		titleArray := []string{}

		for key := range queryMap[0] {
			titleArray = append(titleArray, key)
		}

		sort.Strings(titleArray)

		_, err = file.WriteString(strings.Join(titleArray, ","))
		if err != nil {
			return fileWriterErrMsg, err
		}

		for x := 0; x < len(queryMap); x++ {
			rowEntry := "\n"
			for y := 0; y < len(queryMap[x]); y++ {
				rowEntry += fmt.Sprintf("%v,", queryMap[x][titleArray[y]])
			}
			rowEntry = rowEntry[:len(rowEntry)-1]
			_, err = file.WriteString(rowEntry)
			if err != nil {
				return fileWriterErrMsg, err
			}
		}
		file.Close()
	}

	return "Data dump succesful", nil
}

// QueryMsgIDAndTimeRange will request certain fields for the Mavlink message with the specified name.
// A full list of mavlink message IDs and their fields can be found here http://mavlink.io/en/messages/common.html
//
// Each message has an name associated with it. For example, the message of ID #33 is named
// "GLOBAL_POSITION_INT"
//
// Each message also has various fields included in it. For example, the message named "GLOBAL_POSITION_INT" has the
// following fields: "time_boot_ms", "lat", "lon", "alt", "relative_alt", "vx", "vy", "vz".
//
// Parameters:
//   - msgID:   ID number of the message ID to query
//   - endTime: The endTime is the "stop" inside query time "range(start: , stop:)".
//     The preset value for start -12*Time.Hour as an attemp to go as far
//     back as possible. Note that the type is a string, so if you wanted to query
//     up until now, you would provide time.Now().Format(time.RFC3339) as the
//     argument.
//
// Return:
//   - []map[string]interface{}: list of maps. each map has keys as field names and values are the values associated with the keys
//   - error: Could relate to InfluxDB connection, Requested msgID being invalid, etc.
func (c *Client) QueryMsgIDAndTimeRange(msgID uint32, endTime *string) ([]map[string]interface{}, error) {
	if !c.IsConnected() {
		return nil, errInluxDBNotConnected
	}
	query := fmt.Sprintf(`from(bucket:"%s") |> range(start: -duration(v: %d), stop: %s) |> filter(fn: (r) => r.ID == "%v")`, c.creds.Bucket, 12*time.Hour, *endTime, msgID)

	result, err := c.querier.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}

	data := make([]map[string]interface{}, 0)
	for result.Next() {
		// see if message with timestamp already exists
		idx := -1
		for i, msg := range data {
			if time, ok := msg["_time"]; ok && time == result.Record().Time().String() {
				idx = i
			}
		}

		if idx == -1 {
			data = append(data, make(map[string]interface{}))
			idx = len(data) - 1
		}
		data[idx][result.Record().Field()] = result.Record().Value()
		data[idx]["_time"] = result.Record().Time().String()
	}
	return data, nil
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
		c.connected = false
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

	// If a timeRange of 0 is provided then we want to query the latest message.
	if timeRange == 0 {
		query += "|> last()"
	}

	query += `|> sort(columns: ["_time"])`

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
