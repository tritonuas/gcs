package main

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
)

func setupHelpers(p string) {
	http.HandleFunc("/judgingserver/start", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		judgingHandle("start", p, w, r)
	})
	http.HandleFunc("/judgingserver/stop", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		judgingHandle("stop", p, w, r)
	})
	http.HandleFunc("/sitl/start", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		simulationHandle("start", p, w, r)
	})
	http.HandleFunc("/sitl/stop", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		simulationHandle("stop", p, w, r)
	})
	http.HandleFunc("/missions/list", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		getMissions(p, w, r)
	})
}

func judgingHandle(action string, path string, w http.ResponseWriter, r *http.Request) {
	kill := "docker kill interop-ucsd"
	rm := "docker rm interop-ucsd"
	exec.Command("sh", "-c", kill).Output()
	out2, _ := exec.Command("sh", "-c", rm).Output()
	if action == "start" {
		mission := r.FormValue("mission")
		fullpath := path + "/" + mission

		start := "docker run -d --restart=unless-stopped --interactive --tty --publish 8000:80 -v " + fullpath + "/:/interop/server/missions  --name interop-ucsd ucsdauvsi/interop"
		Log.Info(fullpath)
		Log.Info(start)
		out3, _ := exec.Command("sh", "-c", start).Output()
		w.Write(out3)
	} else {
		w.Write(out2)
	}
}

func getMissions(path string, w http.ResponseWriter, r *http.Request) {
	files, _ := filepath.Glob(path + "/*")
	output := make([]string, len(files))
	for index, element := range files {
		if info, err := os.Stat(element); err == nil && info.IsDir() {
			Log.Info(filepath.Base(element))
			output[index] = filepath.Base(element)
		}

		// index is the index where we are
		// element is the element from someSlice for where we are
	}
	jData, err := json.Marshal(output)
	if err != nil {
		Log.Error("failed to marshal json")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(jData)
}

func simulationHandle(action string, path string, w http.ResponseWriter, r *http.Request) {
	kill := "docker kill sitl-ucsd"
	rm := "docker rm sitl-ucsd"
	exec.Command("sh", "-c", kill).Output()
	out2, _ := exec.Command("sh", "-c", rm).Output()
	if action == "start" {
		mission_name := r.FormValue("mission")
		mission, _, sitl, e := getMission(path, mission_name)
		if e != nil {
			return
		}
		location := ""
		lat := strconv.FormatFloat(mission["home_pos"].(map[string]interface{})["latitude"].(float64), 'f', -1, 64)
		lon := strconv.FormatFloat(mission["home_pos"].(map[string]interface{})["longitude"].(float64), 'f', -1, 64)
		location = location + lat + ","
		location = location + lon + ","
		location = location + "0" + ","
		takeoff := strconv.FormatFloat(sitl["takeoff_direction"].(float64), 'f', -1, 64)
		location = location + takeoff
		Log.Info(location)
		command := "docker run -d -p 5760:5760 -p 5501:5501 " + "-e SITL_HOME=" + "'" + location + "' " + " --name sitl-ucsd ucsdauvsi/plane.rascal:latest "
		Log.Info(command)
		out3, err := exec.Command("sh", "-c", command).Output()
		Log.Info(err)
		if err != nil {
			w.Write([]byte(err.Error()))
		} else {
			w.Write(out3)
		}
	} else {
		w.Write(out2)
	}
}

func getMission(path string, mission_name string) (mission map[string]interface{}, obstacles map[string]interface{}, sitl map[string]interface{}, e error) {
	Log.Info(path + "/" + mission_name + "/" + "mission.json")
	m, e := readJSON(path + "/" + mission_name + "/" + "mission.json")
	if e != nil {
		return nil, nil, nil, e
	}
	o, e := readJSON(path + "/" + mission_name + "/" + "obstacles.json")
	if e != nil {
		return nil, nil, nil, e
	}
	s, e := readJSON(path + "/" + mission_name + "/" + "sitl.json")
	if e != nil {
		return nil, nil, nil, e
	}
	return m, o, s, nil
}

func readJSON(name string) (ma map[string]interface{}, err error) {
	raw, err := ioutil.ReadFile(name)
	if err != nil {
		Log.Warning("counldn't read file")
		return nil, err
	}

	var m map[string]interface{}
	err = json.Unmarshal([]byte(raw), &m)
	if err != nil {
		Log.Warning(err)
		return nil, err
	}
	return m, nil
}
