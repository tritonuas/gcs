package clustering

import (
	"fmt"
	"strings"
	"encoding/json"
	"sync"

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
	LastID      int
	Mu          sync.RWMutex
}

func (clusters *ClusterManager) ToggleDetection(id int) {
	clusters.Mu.Lock()
	defer clusters.Mu.Unlock()
	out := clusters.FindDetection(id)
	out.Rejected = !out.Rejected
}
func (clusters *ClusterManager) FindDetection(id int) *Detection {
	for i := range clusters.ClusterData {
		for j := range clusters.ClusterData[i].Detections {
			if clusters.ClusterData[i].Detections[j].Id == id {
				return &clusters.ClusterData[i].Detections[j]
			}
		}
	}
	return &Detection{}
}
func (clusters *ClusterManager) GetAllDetections() []Detection {
	all_detections := make([]Detection, 0, clusters.LastID)
	for _, el := range clusters.ClusterData {
		all_detections = append(all_detections, el.Detections...)

	}
	return all_detections
}

func (clusters *ClusterManager) AddDetection(data string) error {
	var identifiedTargets []map[string]interface{}
	err := json.Unmarshal([]byte(data), &identifiedTargets)
	if err != nil {

		return err
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
	clusters.Mu.Lock()
	defer clusters.Mu.Unlock()
	for j := range identifiedTargets {
		detections_str, err := json.Marshal(&identifiedTargets[j])
		if err != nil {
			return err
		}
		var detections protos.IdentifiedTarget
		protojson.Unmarshal(detections_str, &detections)
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

/unc New() *ClusterManager {
	return &ClusterManager{
		ClusterData: make(map[protos.AirdropType]*ClusterData),
	}
}
