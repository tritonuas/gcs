package utils

import (
	"context"
	"errors"
	"fmt"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	influxApi "github.com/influxdata/influxdb-client-go/v2/api"
)

type InfluxClient struct {
	client   influxdb2.Client
	queryAPI influxApi.QueryAPI
	uri      string
	token    string
	bucket   string
	org      string
}

// NewInfluxClient creates a new InfluxClient to make queries with.
func NewInfluxClient(uri string, token string, bucket string, org string) InfluxClient {
	client := influxdb2.NewClient(uri, token)
	queryAPI := client.QueryAPI(org)

	return InfluxClient{client, queryAPI, uri, token, bucket, org}
}

// QueryLatest queries the latest entry of the given field(s) in InfluxDB (from the subset of mavlink messages of the given type).
//
// Eg: QueryLatest(33,["lat","lon"]) -> {lat:"123",lon:"432"}, where 33 is the telemetry update packet (I think)
func (this InfluxClient) QueryLatest(messageID int, fields []string) (map[string]string, error) {
	// Convert array of field strings into Influx Query strings
	queries := make([]string, len(fields))
	for i, fieldName := range fields {
		queries[i] = fmt.Sprintf(`from(bucket:"%s") |> range(start: -1m) |> tail(n: 1, offset: 0) |> filter(fn: (r) => r.ID == "%d") |> filter(fn: (r) => r._field == "%s")`,
			this.bucket,
			messageID,
			fieldName)
	}

	// Get the data from Influx
	mapToReturn := make(map[string]string)

	for i, query := range queries {
		// Make the request to InfluxDB
		response, err := this.queryAPI.Query(context.Background(), query)

		// Deal with errors
		if err != nil {
			return nil, err
		}
		if !response.Next() {
			return nil, errors.New(fmt.Sprintf("Requested telemetry with query %s not found in InfluxDB. Check the id and field in the Mavlink documentation at http://mavlink.io/en/messages/common.html", query))
		}

		// Get the data from the query response
		val := fmt.Sprint(response.Record().Value())
		// And store it in the Map under the field that queried it
		mapToReturn[fields[i]] = val
	}

	return mapToReturn, nil
}
