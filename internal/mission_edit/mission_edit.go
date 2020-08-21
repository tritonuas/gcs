package mission_edit

import (
	"os"
	"path/filepath"

	"github.com/golang/protobuf/jsonpb"
	"github.com/sirupsen/logrus"
	pb "github.com/tritonuas/hub/internal/interop"
)

var Log = logrus.New()

func get_missionlist(folder string) (output []string) {
	files, _ := filepath.Glob(folder + "/*")
	for _, element := range files {
		filename := filepath.Base(element)
		extension := filepath.Ext(filename)
		if info, err := os.Stat(element); err == nil && !info.IsDir() && extension == ".json" {
			output = append(output, filename[:len(filename)-len(extension)])
		}
	}
	return output
}

func get_mission(mission_folder string, mission_name string) (*pb.CompleteMission, error) {
	mission := &pb.CompleteMission{}
	reader, err := os.Open(mission_folder + "/" + mission_name + ".json")
	if err != nil {
		return nil, err
	}
	if err = jsonpb.Unmarshal(reader, mission); err != nil {
		Log.Error("error: %s", err.Error())
		return nil, err
	}
	return mission, nil
}

func edit_mission(mission_folder string, mission *pb.CompleteMission) error {
	mission_name := mission.GetMissionName()
	writer, err := os.Create(mission_folder + "/" + mission_name + ".json")
	if err != nil {
		return err
	}
	marshaler := jsonpb.Marshaler{
		OrigName:     true,
		EmitDefaults: true,
		Indent:       "    ",
	}
	if err = marshaler.Marshal(writer, mission); err != nil {
		Log.Error("error: %s", err.Error())
		return err
	}
	return nil
}
