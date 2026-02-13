package clustering

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/tritonuas/gcs/internal/protos"
	"google.golang.org/protobuf/encoding/protojson"
)

type Detection struct {
	Image    string
	Location *protos.GPSCoord `json:"location"`
	Disabled bool
}
type ClusterData struct {
	TargetType    protos.AirdropType `json:"target_type"`
	Detections    []Detection        `json:"detections"`
	ClusterCenter *protos.GPSCoord   `json:"center"`
	IsManuallySelected bool  `json:"center_selected"`/
}
type ClusterManager struct {
	ClusterData map[protos.AirdropType]*ClusterData
}

func findCenter(data *ClusterData) error {
	if len((*data).Detections) == 0 {
		return errors.New("Cluster data is empty. There are no centers to find")
	}

	latitudesData := append([]Detection{}, (*data).Detections...)
	longitudesData := append([]Detection{}, (*data).Detections...)

	sort.Slice(latitudesData, func(i, j int) bool {
		return latitudesData[i].Location.Latitude > latitudesData[j].Location.Latitude
	})

	sort.Slice(longitudesData, func(i, j int) bool {
		return longitudesData[i].Location.Latitude > longitudesData[j].Location.Latitude
	})

	midPoint := len(data.Detections) / 2

	(*(*data).ClusterCenter).Longitude = longitudesData[midPoint].Location.Longitude
	(*(*data).ClusterCenter).Latitude = latitudesData[midPoint].Location.Latitude

	return nil
}

func (clusters *ClusterManager) findAllCenters() []error {

	errors := make([]error, len((*clusters).ClusterData))

	for i, detectionType := range (*clusters).ClusterData {
		errors[i] = findCenter(detectionType)
	}

	return errors
}

func (clusters *ClusterManager) AddDetection(data string) error {
	out, jsonerr := ExtractJSONListAsStrings(data)
	if jsonerr != nil {
		return jsonerr
	}
	identifiedTargets := make([]*protos.IdentifiedTarget, len(out))
	for _, str := range out {
		var result protos.IdentifiedTarget
		protojsonerr := protojson.Unmarshal([]byte(str), &result)
		if protojsonerr != nil {
			return protojsonerr
		}
		identifiedTargets = append(identifiedTargets, &result)
	}
	for j := range identifiedTargets {
		detections := identifiedTargets[j]
		if detections == nil {
			continue
		}
		for i, airdrop_type := range detections.TargetType {
			cluster := clusters.ClusterData[airdrop_type]

			if cluster != nil {
				cluster.Detections = append(cluster.Detections, Detection{
					Image:    detections.GetPicture(),
					Location: detections.GetCoordinates()[i],
					Disabled: false,
				})

			} else {
				clusters.ClusterData[airdrop_type] = &ClusterData{
					Detections: []Detection{{
						Image:    detections.GetPicture(),
						Location: detections.GetCoordinates()[i],
						Disabled: false,
					}},
					TargetType:    airdrop_type,
					ClusterCenter: detections.GetCoordinates()[i],
				}
			}

		}
	}
	return nil
}

// Util method which takes a json list as a string and returns a list of each object contaied. This only exists because of one niche use case here where we cant parse a list of protos but cannot parse them as normal json
func ExtractJSONListAsStrings(jsonStr string) ([]string, error) {
	jsonStr = strings.TrimSpace(jsonStr)

	// Check if it's a valid JSON array
	if !strings.HasPrefix(jsonStr, "[") || !strings.HasSuffix(jsonStr, "]") {
		return nil, fmt.Errorf("input is not a valid JSON array")
	}

	// Remove the outer brackets
	content := jsonStr[1 : len(jsonStr)-1]

	var result []string
	var current strings.Builder
	var depth int
	var inString bool
	var escaped bool

	for _, char := range content {
		// Handle escape sequences
		if escaped {
			current.WriteRune(char)
			escaped = false
			continue
		}

		if char == '\\' {
			current.WriteRune(char)
			escaped = true
			continue
		}

		// Toggle string state
		if char == '"' {
			inString = !inString
			current.WriteRune(char)
			continue
		}

		// Track braces only when not in a string
		if !inString {
			switch char {
			case '{':
				depth++
				current.WriteRune(char)
			case '}':
				current.WriteRune(char)
				depth--

				// When we close an object at depth 0, extract it
				if depth == 0 {
					obj := strings.TrimSpace(current.String())
					if obj != "" {
						result = append(result, obj)
					}
					current.Reset()
				}
			case ',':
				if depth != 0 {
					current.WriteRune(char)
				}
				// Skip commas between top-level objects (when depth == 0)
			default:
				current.WriteRune(char)
			}
		} else {
			current.WriteRune(char)
		}
	}

	return result, nil
}
func New() *ClusterManager {
	return &ClusterManager{
		ClusterData: make(map[protos.AirdropType]*ClusterData),
	}
}
