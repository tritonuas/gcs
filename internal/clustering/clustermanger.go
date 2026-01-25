package clustering

import (
	"fmt"
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
}
type ClusterManager struct {
	ClusterData map[protos.AirdropType]*ClusterData
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
			if char == '{' {
				depth++
				current.WriteRune(char)
			} else if char == '}' {
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
			} else if char == ',' && depth == 0 {
				// Skip commas between top-level objects
				continue
			} else {
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
