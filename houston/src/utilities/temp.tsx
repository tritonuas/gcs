// This file is holding TEMPORARY definitions which will eventually be removed
// TODO: implement protobufs and remove these defs

// TODO: standardize connection status data structure
// and make it a protobuf
export interface ConnectionStatus {
    name: string,
    isActive: boolean
    type: ConnectionType
}

export const enum ConnectionType {
    Radio,
    Ethernet,
    Wifi
}