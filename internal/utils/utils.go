package main

import (
	"path"
	"path/filepath"
)

func get_path(executable_folder, hub_path, relative_path string) string {
	fullpath, err := filepath.Abs(path.Dir(executable_folder + string(filepath.Separator) + hub_path + relative_path))
	if err != nil {
		panic(err)
	}
	return fullpath
}
