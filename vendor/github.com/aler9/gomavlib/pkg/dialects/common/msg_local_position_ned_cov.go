//autogenerated:yes
//nolint:revive,misspell,govet,lll
package common

// The filtered local position (e.g. fused computer vision and accelerometers). Coordinate frame is right-handed, Z-axis down (aeronautical frame, NED / north-east-down convention)
type MessageLocalPositionNedCov struct {
	// Timestamp (UNIX Epoch time or time since system boot). The receiving end can infer timestamp format (since 1.1.1970 or since system boot) by checking for the magnitude of the number.
	TimeUsec uint64
	// Class id of the estimator this estimate originated from.
	EstimatorType MAV_ESTIMATOR_TYPE `mavenum:"uint8"`
	// X Position
	X float32
	// Y Position
	Y float32
	// Z Position
	Z float32
	// X Speed
	Vx float32
	// Y Speed
	Vy float32
	// Z Speed
	Vz float32
	// X Acceleration
	Ax float32
	// Y Acceleration
	Ay float32
	// Z Acceleration
	Az float32
	// Row-major representation of position, velocity and acceleration 9x9 cross-covariance matrix upper right triangle (states: x, y, z, vx, vy, vz, ax, ay, az; first nine entries are the first ROW, next eight entries are the second row, etc.). If unknown, assign NaN value to first element in the array.
	Covariance [45]float32
}

// GetID implements the msg.Message interface.
func (*MessageLocalPositionNedCov) GetID() uint32 {
	return 64
}