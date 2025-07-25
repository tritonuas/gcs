// Package cvs contains data structures and helper functions used for
// storing and manipulating computer-vision (CV) data throughout the GCS.
package cvs

// InitializeData creates and returns an empty Computer Vision Data struct
// to be populated later.
func InitializeData() *Data {
	data := &Data{
		ClassifiedODLCs: []ClassifiedODLC{},
	}

	return data
}
