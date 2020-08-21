package mission_edit

import (
	"os"
	"fmt"
	"path/filepath"

	"github.com/golang/protobuf/jsonpb"
	"github.com/sirupsen/logrus"
	pb "github.com/tritonuas/hub/internal/interop"
)

var Log *logrus.Logger

func get_pathlist(folder string) (output []string) {
	fmt.Println(folder)
	files, _ := filepath.Glob(folder + "/*")
	for _, element := range files {
		fmt.Println(element)
		filename := filepath.Base(element)
		extension := filepath.Ext(filename)
		if info, err := os.Stat(element); err == nil && !info.IsDir() && extension == ".json" {
			output = append(output, filename[:len(filename)-len(extension)])
		}
	}
	return output
}

func get_path(mission_folder string, mission_name string) (*pb.Path, error) {
	mission := &pb.Path{}
	reader, err := os.Open(mission_folder + "/" + mission_name + ".json")
	if err != nil {
		return nil, err
	}
	if err = jsonpb.Unmarshal(reader, mission); err != nil {
		//Log.Error("error: %s", err.Error())
		return nil, err
	}
	return mission, nil
}

func edit_path(mission_folder string, mission *pb.Path) error {
	mission_name := mission.GetPathName()
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
