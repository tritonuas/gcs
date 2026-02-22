package clustering

import (
	"fmt"
	"math"
	"reflect"
	"testing"

	"github.com/tritonuas/gcs/internal/protos"
)

// Make sure the function returns an error when detections
// is an empty slice.
func TestClusteringEmpty(t *testing.T) {

	detections := make([]Detection, 0)
	detectionPoint := protos.GPSCoord{}

	data := ClusterData{Detections: detections, ClusterCenter: &detectionPoint}
	err := findCenter(&data)
	if err == nil {
		t.Errorf("An error was supposed to occur as no data was sent. \n")
	} else {
		fmt.Printf(err.Error())
	}
}

// Make sure the function returns an error when ClusterCenter
// is a nil pointer to prevent nil pointer dereferencing.
func TestClusteringInvalid(t *testing.T) {

	detections := make([]Detection, 1)
	data := ClusterData{Detections: detections}
	err := findCenter(&data)

	if err == nil {
		t.Errorf("An error was supposed to occur as a nil pointer was sent as the location of the cluster center. \n")
	} else {
		fmt.Printf(err.Error())
	}
}

// Make sure that the median is calculated by averaging the two middle datapoints
// when the number of datapoints is even. Due to floating point division not being
// 100% accurate, i've tested this by making sure that the difference between the
// expected and actual value is less than 1e-6.
func TestClusteringEven(t *testing.T) {

	const trueMedianLat = 37.774905
	const trueMedianLong = -122.419395
	const eps = 1e-6

	points := []protos.GPSCoord{
		{Latitude: 37.77480, Longitude: -122.41950},
		{Latitude: 37.77482, Longitude: -122.41948},
		{Latitude: 37.77483, Longitude: -122.41947},
		{Latitude: 37.77484, Longitude: -122.41946},
		{Latitude: 37.77485, Longitude: -122.41945},
		{Latitude: 37.77486, Longitude: -122.41944},
		{Latitude: 37.77487, Longitude: -122.41943},
		{Latitude: 37.77488, Longitude: -122.41942},
		{Latitude: 37.77489, Longitude: -122.41941},
		{Latitude: 37.77490, Longitude: -122.41940},
		{Latitude: 37.77491, Longitude: -122.41939},
		{Latitude: 37.77492, Longitude: -122.41938},
		{Latitude: 37.77493, Longitude: -122.41937},
		{Latitude: 37.77494, Longitude: -122.41936},
		{Latitude: 37.77495, Longitude: -122.41935},
		{Latitude: 37.77496, Longitude: -122.41934},
		{Latitude: 37.77497, Longitude: -122.41933},
		{Latitude: 37.77498, Longitude: -122.41932},
		{Latitude: 37.77499, Longitude: -122.41931},
		{Latitude: 37.77500, Longitude: -122.41930},
	}

	detectionPoint := protos.GPSCoord{
		Latitude: 0, Longitude: 0,
	}

	detections := make([]Detection, len(points))

	for i, point := range points {
		p := point
		detections[i].Location = &p
	}

	data := ClusterData{Detections: detections, ClusterCenter: &detectionPoint}

	err := findCenter(&data)

	if err != nil {
		fmt.Printf(err.Error())
		t.Errorf("An error occurred in finding the center. \n")
	}

	if math.Abs(data.ClusterCenter.Latitude-trueMedianLat) > eps {
		t.Errorf("Incorrect latitude found. Got %v but expected %v \n",
			data.ClusterCenter.Latitude, trueMedianLat)
	}

	if math.Abs(data.ClusterCenter.Longitude-trueMedianLong) > eps {
		t.Errorf("Incorrect longitude found. Got %v but expected %v \n",
			data.ClusterCenter.Longitude, trueMedianLong)
	}
}

// Make sure that the median is calculated correctly from many datapoints
// when the number of datapoints is odd.
func TestClusteringOdd(t *testing.T) {

	const trueMedianLat = 37.77490
	const trueMedianLong = -122.41940

	points := []protos.GPSCoord{
		{Latitude: 37.77485, Longitude: -122.41946},
		{Latitude: 37.77488, Longitude: -122.41939},
		{Latitude: 37.77490, Longitude: -122.41940},
		{Latitude: 37.77492, Longitude: -122.41937},
		{Latitude: 37.77491, Longitude: -122.41943},
		{Latitude: 37.77489, Longitude: -122.41935},
		{Latitude: 37.77494, Longitude: -122.41944},
		{Latitude: 37.77487, Longitude: -122.41942},
		{Latitude: 37.77501, Longitude: -122.41938},
		{Latitude: 37.77486, Longitude: -122.41945},
		{Latitude: 37.77493, Longitude: -122.41936},
		{Latitude: 37.77495, Longitude: -122.41934},
		{Latitude: 37.77484, Longitude: -122.41947},
		{Latitude: 37.77496, Longitude: -122.41933},
		{Latitude: 37.77489, Longitude: -122.41941},
	}

	detectionPoint := protos.GPSCoord{
		Latitude: 0, Longitude: 0,
	}

	detections := make([]Detection, len(points))

	for i, point := range points {
		p := point
		detections[i].Location = &p
	}

	data := ClusterData{Detections: detections, ClusterCenter: &detectionPoint}

	err := findCenter(&data)

	if err != nil {
		fmt.Printf(err.Error())
		t.Errorf("An error occurred in finding the center. \n")
	}

	if !reflect.DeepEqual(data.ClusterCenter.Latitude, trueMedianLat) {
		t.Errorf("Incorrect latitude found. Got %v but expected %v \n",
			data.ClusterCenter.Latitude, trueMedianLat)
	}

	if !reflect.DeepEqual(data.ClusterCenter.Longitude, trueMedianLong) {
		t.Errorf("Incorrect longitude found. Got %v but expected %v \n",
			data.ClusterCenter.Longitude, trueMedianLong)
	}
}
