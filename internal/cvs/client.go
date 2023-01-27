package cvs

// Create an empty Computer Vision Data struct to be populated later
func InitializeData() *Data {
	data := &Data{
		ClassifiedODLCs: []ClassifiedODLC{},
	}

	return data
}
