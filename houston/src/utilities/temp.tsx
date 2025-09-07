// Houston interface for displaying connection status
// Originally these were going to be temporary and a protobuf
// was going to hold the data being sent directly in the
// /connections route, but I am lazy and we're time crunched
// and this will just work

export interface ConnectionStatus {
  name: string;
  isActive: boolean;
  type: ConnectionType;
}

export const enum ConnectionType {
  Radio,
  Ethernet,
  Wifi,
}
