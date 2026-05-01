package clustering

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"sort"
	"strings"
	"sync"

	"github.com/tritonuas/gcs/internal/protos"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

type Detection struct {
	Location *protos.GPSCoord `json:"location"`
	Rejected bool             `json:"rejected"`
	Id       int              `json:"id"`
}
type ClusterData struct {
	TargetType    protos.AirdropType `json:"target_type"`
	Detections    []Detection        `json:"detections"`
	ClusterCenter *protos.GPSCoord   `json:"center"`
}
type ClusterManager struct {
	ClusterData map[protos.AirdropType]*ClusterData
	LastID      int
	mu          sync.RWMutex
	Images      map[int][]byte
}

func (clusters *ClusterManager) ToggleDetection(id int) error {
	clusters.mu.Lock()
	defer clusters.mu.Unlock()
	var detection_type protos.AirdropType
	for i := range clusters.ClusterData {
		for j := range clusters.ClusterData[i].Detections {
			if clusters.ClusterData[i].Detections[j].Id == id {
				detection_type = i
				clusters.ClusterData[i].Detections[j].Rejected = !clusters.ClusterData[i].Detections[j].Rejected
				break
			}
		}
	}
	err := findCenter(clusters.ClusterData[detection_type])
	if err != nil {
		return err
	}
	return nil
}

func (clusters *ClusterManager) FindDetection(id int) *Detection {
	for i := range clusters.ClusterData {
		for j := range clusters.ClusterData[i].Detections {
			if clusters.ClusterData[i].Detections[j].Id == id {
				return &clusters.ClusterData[i].Detections[j]
			}
		}
	}
	return nil
}
func (clusters *ClusterManager) GetAllDetections() []Detection {
	all_detections := make([]Detection, 0, clusters.LastID)
	for _, el := range clusters.ClusterData {
		all_detections = append(all_detections, el.Detections...)

	}
	return all_detections
}
func (clusters *ClusterManager) GetLaunchCoordinates() []*protos.AirdropTarget {
	clusters.mu.RLock()
	defer clusters.mu.RUnlock()
	all_targets := make([]*protos.AirdropTarget, 0, len(clusters.ClusterData))
	for _, el := range clusters.ClusterData {
		target := &protos.AirdropTarget{
			Index:      el.TargetType,
			Coordinate: el.ClusterCenter,
		}
		all_targets = append(all_targets, target)
	}
	return all_targets
}
func findCenter(data *ClusterData) error {

	if len(data.Detections) == 0 {
		return errors.New("cluster data is empty. There are no centers to find")
	}
	if data.ClusterCenter == nil {
		return errors.New("null cluster center")
	}
	var lats []float64
	var lons []float64
	for _, d := range data.Detections {
		if !d.Rejected {
			lats = append(lats, d.Location.Latitude)
			lons = append(lons, d.Location.Longitude)
		}
	}
	sort.Slice(lats, func(i, j int) bool {
		return lats[i] < lats[j]
	})

	sort.Slice(lons, func(i, j int) bool {
		return lons[i] < lons[j]
	})

	// Case where the number of datapoints are even
	// so we average the two closest to the middle.
	if len(lats)%2 == 0 {
		mp1 := len(lats) / 2
		mp2 := len(lats)/2 - 1
		data.ClusterCenter = &protos.GPSCoord{}
		data.ClusterCenter.Latitude = (lats[mp1] + lats[mp2]) / 2.0
		data.ClusterCenter.Longitude = (lons[mp1] + lons[mp2]) / 2.0
		return nil
	}

	midPoint := len(lats) / 2
	data.ClusterCenter = &protos.GPSCoord{}
	data.ClusterCenter.Longitude = lons[midPoint]
	data.ClusterCenter.Latitude = lats[midPoint]
	return nil
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
	clusters.mu.Lock()
	defer clusters.mu.Unlock()
	for j := range identifiedTargets {
		detections := identifiedTargets[j]
		if detections == nil {
			continue
		}
		for i, airdrop_type := range detections.TargetType {
			cluster := clusters.ClusterData[airdrop_type]
			imgbytes, b64error := base64.StdEncoding.DecodeString(detections.GetPicture())
			if b64error != nil {
				// maybe set image to some error display?
				log.Println(b64error)
			} else {
				clusters.Images[clusters.LastID] = imgbytes
			}
			if cluster != nil {
				cluster.Detections = append(cluster.Detections, Detection{
					Location: detections.GetCoordinates()[i],
					Rejected: false,
					Id:       clusters.LastID,
				})
				clusters.LastID++
			} else {
				new_center := proto.Clone(detections.GetCoordinates()[i]).(*protos.GPSCoord)
				clusters.ClusterData[airdrop_type] = &ClusterData{
					Detections: []Detection{{
						Location: detections.GetCoordinates()[i],
						Rejected: false,
						Id:       clusters.LastID,
					}},
					TargetType:    airdrop_type,
					ClusterCenter: new_center,
				}
				clusters.LastID++
			}
		}
	}
	for _, data := range clusters.ClusterData {
		center_error := findCenter(data)
		return center_error
	}
	return nil
}

func (clusters *ClusterManager) GetDetectionImage(id int) ([]byte, bool) {
	clusters.mu.RLock()
	defer clusters.mu.RUnlock()
	out, ok := clusters.Images[id]
	return out, ok
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

		Images: make(map[int][]byte),
	}
}
