// Code generated by protoc-gen-go. DO NOT EDIT.
// source: interop/path.proto

package interop

import proto "github.com/golang/protobuf/proto"
import fmt "fmt"
import math "math"

// Reference imports to suppress errors if they are not otherwise used.
var _ = proto.Marshal
var _ = fmt.Errorf
var _ = math.Inf

// This is a compile-time assertion to ensure that this generated file
// is compatible with the proto package it is being compiled against.
// A compilation error at this line likely means your copy of the
// proto package needs to be updated.
const _ = proto.ProtoPackageIsVersion2 // please upgrade the proto package

type WaypointType int32

const (
	WaypointType_HOME       WaypointType = 0
	WaypointType_TAKEOFF    WaypointType = 1
	WaypointType_LAND       WaypointType = 2
	WaypointType_LAND_START WaypointType = 3
	WaypointType_NAV        WaypointType = 4
)

var WaypointType_name = map[int32]string{
	0: "HOME",
	1: "TAKEOFF",
	2: "LAND",
	3: "LAND_START",
	4: "NAV",
}
var WaypointType_value = map[string]int32{
	"HOME":       0,
	"TAKEOFF":    1,
	"LAND":       2,
	"LAND_START": 3,
	"NAV":        4,
}

func (x WaypointType) String() string {
	return proto.EnumName(WaypointType_name, int32(x))
}
func (WaypointType) EnumDescriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{0}
}

type FlownWaypoint struct {
	Point                *Point       `protobuf:"bytes,1,opt,name=point" json:"point,omitempty"`
	Type                 WaypointType `protobuf:"varint,2,opt,name=type,enum=interop.WaypointType" json:"type,omitempty"`
	Wpradius             float32      `protobuf:"fixed32,3,opt,name=wpradius" json:"wpradius,omitempty"`
	XXX_NoUnkeyedLiteral struct{}     `json:"-"`
	XXX_unrecognized     []byte       `json:"-"`
	XXX_sizecache        int32        `json:"-"`
}

func (m *FlownWaypoint) Reset()         { *m = FlownWaypoint{} }
func (m *FlownWaypoint) String() string { return proto.CompactTextString(m) }
func (*FlownWaypoint) ProtoMessage()    {}
func (*FlownWaypoint) Descriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{0}
}
func (m *FlownWaypoint) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_FlownWaypoint.Unmarshal(m, b)
}
func (m *FlownWaypoint) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_FlownWaypoint.Marshal(b, m, deterministic)
}
func (dst *FlownWaypoint) XXX_Merge(src proto.Message) {
	xxx_messageInfo_FlownWaypoint.Merge(dst, src)
}
func (m *FlownWaypoint) XXX_Size() int {
	return xxx_messageInfo_FlownWaypoint.Size(m)
}
func (m *FlownWaypoint) XXX_DiscardUnknown() {
	xxx_messageInfo_FlownWaypoint.DiscardUnknown(m)
}

var xxx_messageInfo_FlownWaypoint proto.InternalMessageInfo

func (m *FlownWaypoint) GetPoint() *Point {
	if m != nil {
		return m.Point
	}
	return nil
}

func (m *FlownWaypoint) GetType() WaypointType {
	if m != nil {
		return m.Type
	}
	return WaypointType_HOME
}

func (m *FlownWaypoint) GetWpradius() float32 {
	if m != nil {
		return m.Wpradius
	}
	return 0
}

// TODO
type GCSAction struct {
	Id                   int64    `protobuf:"varint,1,opt,name=id" json:"id,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *GCSAction) Reset()         { *m = GCSAction{} }
func (m *GCSAction) String() string { return proto.CompactTextString(m) }
func (*GCSAction) ProtoMessage()    {}
func (*GCSAction) Descriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{1}
}
func (m *GCSAction) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_GCSAction.Unmarshal(m, b)
}
func (m *GCSAction) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_GCSAction.Marshal(b, m, deterministic)
}
func (dst *GCSAction) XXX_Merge(src proto.Message) {
	xxx_messageInfo_GCSAction.Merge(dst, src)
}
func (m *GCSAction) XXX_Size() int {
	return xxx_messageInfo_GCSAction.Size(m)
}
func (m *GCSAction) XXX_DiscardUnknown() {
	xxx_messageInfo_GCSAction.DiscardUnknown(m)
}

var xxx_messageInfo_GCSAction proto.InternalMessageInfo

func (m *GCSAction) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

type Point struct {
	Latitude             float64  `protobuf:"fixed64,1,opt,name=latitude" json:"latitude,omitempty"`
	Longitude            float64  `protobuf:"fixed64,2,opt,name=longitude" json:"longitude,omitempty"`
	Altitude             float64  `protobuf:"fixed64,3,opt,name=altitude" json:"altitude,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *Point) Reset()         { *m = Point{} }
func (m *Point) String() string { return proto.CompactTextString(m) }
func (*Point) ProtoMessage()    {}
func (*Point) Descriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{2}
}
func (m *Point) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_Point.Unmarshal(m, b)
}
func (m *Point) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_Point.Marshal(b, m, deterministic)
}
func (dst *Point) XXX_Merge(src proto.Message) {
	xxx_messageInfo_Point.Merge(dst, src)
}
func (m *Point) XXX_Size() int {
	return xxx_messageInfo_Point.Size(m)
}
func (m *Point) XXX_DiscardUnknown() {
	xxx_messageInfo_Point.DiscardUnknown(m)
}

var xxx_messageInfo_Point proto.InternalMessageInfo

func (m *Point) GetLatitude() float64 {
	if m != nil {
		return m.Latitude
	}
	return 0
}

func (m *Point) GetLongitude() float64 {
	if m != nil {
		return m.Longitude
	}
	return 0
}

func (m *Point) GetAltitude() float64 {
	if m != nil {
		return m.Altitude
	}
	return 0
}

type Path struct {
	Id                   int64            `protobuf:"varint,1,opt,name=id" json:"id,omitempty"`
	Waypoints            []*FlownWaypoint `protobuf:"bytes,2,rep,name=waypoints" json:"waypoints,omitempty"`
	Partial              bool             `protobuf:"varint,3,opt,name=partial" json:"partial,omitempty"`
	Start                int64            `protobuf:"varint,4,opt,name=start" json:"start,omitempty"`
	ReferenceId          int64            `protobuf:"varint,5,opt,name=reference_id,json=referenceId" json:"reference_id,omitempty"`
	ErrorCode            int64            `protobuf:"varint,6,opt,name=errorCode" json:"errorCode,omitempty"`
	PathName             string           `protobuf:"bytes,7,opt,name=path_name,json=pathName" json:"path_name,omitempty"`
	XXX_NoUnkeyedLiteral struct{}         `json:"-"`
	XXX_unrecognized     []byte           `json:"-"`
	XXX_sizecache        int32            `json:"-"`
}

func (m *Path) Reset()         { *m = Path{} }
func (m *Path) String() string { return proto.CompactTextString(m) }
func (*Path) ProtoMessage()    {}
func (*Path) Descriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{3}
}
func (m *Path) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_Path.Unmarshal(m, b)
}
func (m *Path) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_Path.Marshal(b, m, deterministic)
}
func (dst *Path) XXX_Merge(src proto.Message) {
	xxx_messageInfo_Path.Merge(dst, src)
}
func (m *Path) XXX_Size() int {
	return xxx_messageInfo_Path.Size(m)
}
func (m *Path) XXX_DiscardUnknown() {
	xxx_messageInfo_Path.DiscardUnknown(m)
}

var xxx_messageInfo_Path proto.InternalMessageInfo

func (m *Path) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

func (m *Path) GetWaypoints() []*FlownWaypoint {
	if m != nil {
		return m.Waypoints
	}
	return nil
}

func (m *Path) GetPartial() bool {
	if m != nil {
		return m.Partial
	}
	return false
}

func (m *Path) GetStart() int64 {
	if m != nil {
		return m.Start
	}
	return 0
}

func (m *Path) GetReferenceId() int64 {
	if m != nil {
		return m.ReferenceId
	}
	return 0
}

func (m *Path) GetErrorCode() int64 {
	if m != nil {
		return m.ErrorCode
	}
	return 0
}

func (m *Path) GetPathName() string {
	if m != nil {
		return m.PathName
	}
	return ""
}

type Empty struct {
	Id                   int64    `protobuf:"varint,1,opt,name=id" json:"id,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *Empty) Reset()         { *m = Empty{} }
func (m *Empty) String() string { return proto.CompactTextString(m) }
func (*Empty) ProtoMessage()    {}
func (*Empty) Descriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{4}
}
func (m *Empty) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_Empty.Unmarshal(m, b)
}
func (m *Empty) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_Empty.Marshal(b, m, deterministic)
}
func (dst *Empty) XXX_Merge(src proto.Message) {
	xxx_messageInfo_Empty.Merge(dst, src)
}
func (m *Empty) XXX_Size() int {
	return xxx_messageInfo_Empty.Size(m)
}
func (m *Empty) XXX_DiscardUnknown() {
	xxx_messageInfo_Empty.DiscardUnknown(m)
}

var xxx_messageInfo_Empty proto.InternalMessageInfo

func (m *Empty) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

type StatusUpdate struct {
	Id          int64 `protobuf:"varint,1,opt,name=id" json:"id,omitempty"`
	CurrentPath *Path `protobuf:"bytes,2,opt,name=current_path,json=currentPath" json:"current_path,omitempty"`
	StaticPath  *Path `protobuf:"bytes,3,opt,name=static_path,json=staticPath" json:"static_path,omitempty"`
	// unix timestamp?
	LastUpdate           int64    `protobuf:"varint,4,opt,name=last_update,json=lastUpdate" json:"last_update,omitempty"`
	XXX_NoUnkeyedLiteral struct{} `json:"-"`
	XXX_unrecognized     []byte   `json:"-"`
	XXX_sizecache        int32    `json:"-"`
}

func (m *StatusUpdate) Reset()         { *m = StatusUpdate{} }
func (m *StatusUpdate) String() string { return proto.CompactTextString(m) }
func (*StatusUpdate) ProtoMessage()    {}
func (*StatusUpdate) Descriptor() ([]byte, []int) {
	return fileDescriptor_path_0bd2f1ce355f818c, []int{5}
}
func (m *StatusUpdate) XXX_Unmarshal(b []byte) error {
	return xxx_messageInfo_StatusUpdate.Unmarshal(m, b)
}
func (m *StatusUpdate) XXX_Marshal(b []byte, deterministic bool) ([]byte, error) {
	return xxx_messageInfo_StatusUpdate.Marshal(b, m, deterministic)
}
func (dst *StatusUpdate) XXX_Merge(src proto.Message) {
	xxx_messageInfo_StatusUpdate.Merge(dst, src)
}
func (m *StatusUpdate) XXX_Size() int {
	return xxx_messageInfo_StatusUpdate.Size(m)
}
func (m *StatusUpdate) XXX_DiscardUnknown() {
	xxx_messageInfo_StatusUpdate.DiscardUnknown(m)
}

var xxx_messageInfo_StatusUpdate proto.InternalMessageInfo

func (m *StatusUpdate) GetId() int64 {
	if m != nil {
		return m.Id
	}
	return 0
}

func (m *StatusUpdate) GetCurrentPath() *Path {
	if m != nil {
		return m.CurrentPath
	}
	return nil
}

func (m *StatusUpdate) GetStaticPath() *Path {
	if m != nil {
		return m.StaticPath
	}
	return nil
}

func (m *StatusUpdate) GetLastUpdate() int64 {
	if m != nil {
		return m.LastUpdate
	}
	return 0
}

func init() {
	proto.RegisterType((*FlownWaypoint)(nil), "interop.FlownWaypoint")
	proto.RegisterType((*GCSAction)(nil), "interop.GCSAction")
	proto.RegisterType((*Point)(nil), "interop.Point")
	proto.RegisterType((*Path)(nil), "interop.Path")
	proto.RegisterType((*Empty)(nil), "interop.Empty")
	proto.RegisterType((*StatusUpdate)(nil), "interop.StatusUpdate")
	proto.RegisterEnum("interop.WaypointType", WaypointType_name, WaypointType_value)
}

func init() { proto.RegisterFile("interop/path.proto", fileDescriptor_path_0bd2f1ce355f818c) }

var fileDescriptor_path_0bd2f1ce355f818c = []byte{
	// 464 bytes of a gzipped FileDescriptorProto
	0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0x6c, 0x52, 0xe1, 0x8e, 0x93, 0x4c,
	0x14, 0xfd, 0x80, 0x76, 0x29, 0x97, 0x6e, 0x43, 0x26, 0x9f, 0x4a, 0x5c, 0x13, 0x91, 0xf8, 0x03,
	0xfd, 0x51, 0x4d, 0xf5, 0x05, 0xc8, 0xda, 0xba, 0x46, 0xed, 0x6e, 0xa6, 0x55, 0x7f, 0x19, 0x32,
	0x96, 0xd1, 0x4e, 0x42, 0x61, 0x32, 0x5c, 0xd2, 0x34, 0xf1, 0x65, 0x7c, 0x2d, 0x9f, 0xc6, 0xcc,
	0x40, 0xa9, 0xba, 0xfe, 0xe3, 0x9e, 0x73, 0xee, 0x3d, 0x73, 0x0f, 0x17, 0x88, 0x28, 0x91, 0xab,
	0x4a, 0x3e, 0x93, 0x0c, 0xb7, 0x53, 0xa9, 0x2a, 0xac, 0x88, 0xdb, 0x61, 0xf1, 0x77, 0x38, 0x5f,
	0x14, 0xd5, 0xbe, 0xfc, 0xc4, 0x0e, 0xb2, 0x12, 0x25, 0x92, 0xc7, 0x30, 0x34, 0x1f, 0xa1, 0x15,
	0x59, 0x89, 0x3f, 0x9b, 0x4c, 0x3b, 0xe5, 0xf4, 0x46, 0xa3, 0xb4, 0x25, 0xc9, 0x13, 0x18, 0xe0,
	0x41, 0xf2, 0xd0, 0x8e, 0xac, 0x64, 0x32, 0xbb, 0xd3, 0x8b, 0x8e, 0x63, 0xd6, 0x07, 0xc9, 0xa9,
	0x91, 0x90, 0xfb, 0x30, 0xda, 0x4b, 0xc5, 0x72, 0xd1, 0xd4, 0xa1, 0x13, 0x59, 0x89, 0x4d, 0xfb,
	0x3a, 0xbe, 0x00, 0xef, 0xf5, 0xe5, 0x2a, 0xdd, 0xa0, 0xa8, 0x4a, 0x32, 0x01, 0x5b, 0xe4, 0xc6,
	0xd6, 0xa1, 0xb6, 0xc8, 0xe3, 0xcf, 0x30, 0x34, 0x9e, 0x7a, 0x42, 0xc1, 0x50, 0x60, 0x93, 0x73,
	0x43, 0x5b, 0xb4, 0xaf, 0xc9, 0x03, 0xf0, 0x8a, 0xaa, 0xfc, 0xd6, 0x92, 0xb6, 0x21, 0x4f, 0x80,
	0xee, 0x64, 0x45, 0xd7, 0xe9, 0xb4, 0x9d, 0xc7, 0x3a, 0xfe, 0x69, 0xc1, 0xe0, 0x86, 0xe1, 0xf6,
	0x6f, 0x5f, 0xf2, 0x12, 0xbc, 0x7d, 0xb7, 0x46, 0x1d, 0xda, 0x91, 0x93, 0xf8, 0xb3, 0xbb, 0xfd,
	0x82, 0x7f, 0x84, 0x45, 0x4f, 0x42, 0x12, 0x82, 0x2b, 0x99, 0x42, 0xc1, 0x0a, 0xe3, 0x34, 0xa2,
	0xc7, 0x92, 0xfc, 0x0f, 0xc3, 0x1a, 0x99, 0xc2, 0x70, 0x60, 0x2c, 0xda, 0x82, 0x3c, 0x82, 0xb1,
	0xe2, 0x5f, 0xb9, 0xe2, 0xe5, 0x86, 0x67, 0x22, 0x0f, 0x87, 0x86, 0xf4, 0x7b, 0xec, 0x4d, 0xae,
	0x77, 0xe3, 0x4a, 0x55, 0xea, 0xb2, 0xca, 0x79, 0x78, 0x66, 0xf8, 0x13, 0x40, 0x2e, 0xc0, 0xd3,
	0x3f, 0x34, 0x2b, 0xd9, 0x8e, 0x87, 0x6e, 0x64, 0x25, 0x1e, 0x1d, 0x69, 0x60, 0xc9, 0x76, 0x3c,
	0xbe, 0x07, 0xc3, 0xf9, 0x4e, 0xe2, 0xe1, 0x56, 0xa8, 0x3f, 0x2c, 0x18, 0xaf, 0x90, 0x61, 0x53,
	0x7f, 0x90, 0x39, 0x43, 0x7e, 0x6b, 0xfb, 0xe7, 0x30, 0xde, 0x34, 0x4a, 0xf1, 0x12, 0x33, 0x3d,
	0xcd, 0x64, 0xea, 0xcf, 0xce, 0x4f, 0x67, 0xc0, 0x70, 0x4b, 0xfd, 0x4e, 0x62, 0xf2, 0x9b, 0x82,
	0x5f, 0x23, 0x43, 0xb1, 0x69, 0x1b, 0x9c, 0x7f, 0x35, 0x40, 0xab, 0x30, 0xfa, 0x87, 0xe0, 0x17,
	0xac, 0xc6, 0xac, 0x31, 0x0f, 0xe8, 0x52, 0x01, 0x0d, 0xb5, 0x4f, 0x7a, 0x7a, 0x05, 0xe3, 0xdf,
	0xef, 0x88, 0x8c, 0x60, 0x70, 0x75, 0xfd, 0x7e, 0x1e, 0xfc, 0x47, 0x7c, 0x70, 0xd7, 0xe9, 0xdb,
	0xf9, 0xf5, 0x62, 0x11, 0x58, 0x1a, 0x7e, 0x97, 0x2e, 0x5f, 0x05, 0x36, 0x99, 0x00, 0xe8, 0xaf,
	0x6c, 0xb5, 0x4e, 0xe9, 0x3a, 0x70, 0x88, 0x0b, 0xce, 0x32, 0xfd, 0x18, 0x0c, 0xbe, 0x9c, 0x99,
	0x6b, 0x7f, 0xf1, 0x2b, 0x00, 0x00, 0xff, 0xff, 0x26, 0xf5, 0x11, 0xbd, 0x03, 0x03, 0x00, 0x00,
}