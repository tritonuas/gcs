/* eslint-disable */
import * as _m0 from "protobufjs/minimal";

export const protobufPackage = "";

export enum ConnectionName {
  AntennaTracker = 0,
  OnboardComputer = 1,
  RadioMavlink = 2,
  UNRECOGNIZED = -1,
}

export function connectionNameFromJSON(object: any): ConnectionName {
  switch (object) {
    case 0:
    case "AntennaTracker":
      return ConnectionName.AntennaTracker;
    case 1:
    case "OnboardComputer":
      return ConnectionName.OnboardComputer;
    case 2:
    case "RadioMavlink":
      return ConnectionName.RadioMavlink;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ConnectionName.UNRECOGNIZED;
  }
}

export function connectionNameToJSON(object: ConnectionName): string {
  switch (object) {
    case ConnectionName.AntennaTracker:
      return "AntennaTracker";
    case ConnectionName.OnboardComputer:
      return "OnboardComputer";
    case ConnectionName.RadioMavlink:
      return "RadioMavlink";
    case ConnectionName.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export enum ConnectionType {
  Ethernet = 0,
  Radio = 1,
  Wifi = 2,
  UNRECOGNIZED = -1,
}

export function connectionTypeFromJSON(object: any): ConnectionType {
  switch (object) {
    case 0:
    case "Ethernet":
      return ConnectionType.Ethernet;
    case 1:
    case "Radio":
      return ConnectionType.Radio;
    case 2:
    case "Wifi":
      return ConnectionType.Wifi;
    case -1:
    case "UNRECOGNIZED":
    default:
      return ConnectionType.UNRECOGNIZED;
  }
}

export function connectionTypeToJSON(object: ConnectionType): string {
  switch (object) {
    case ConnectionType.Ethernet:
      return "Ethernet";
    case ConnectionType.Radio:
      return "Radio";
    case ConnectionType.Wifi:
      return "Wifi";
    case ConnectionType.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export interface ConnectionStatus {
  name: ConnectionName;
  isActive: boolean;
  type: ConnectionType;
}

export interface ATConnectionInfo {
  lat: number;
  lon: number;
  direction: number;
  log: string;
}

export interface OBCConnectionInfo {
  mavHeartbeat: number;
  cameraConnected: boolean;
}

export interface RMavConnectionInfo {
  mavHeartbeat: number;
}

function createBaseConnectionStatus(): ConnectionStatus {
  return { name: 0, isActive: false, type: 0 };
}

export const ConnectionStatus = {
  encode(message: ConnectionStatus, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== 0) {
      writer.uint32(8).int32(message.name);
    }
    if (message.isActive === true) {
      writer.uint32(16).bool(message.isActive);
    }
    if (message.type !== 0) {
      writer.uint32(24).int32(message.type);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConnectionStatus {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConnectionStatus();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.name = reader.int32() as any;
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.isActive = reader.bool();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.type = reader.int32() as any;
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ConnectionStatus {
    return {
      name: isSet(object.name) ? connectionNameFromJSON(object.name) : 0,
      isActive: isSet(object.isActive) ? globalThis.Boolean(object.isActive) : false,
      type: isSet(object.type) ? connectionTypeFromJSON(object.type) : 0,
    };
  },

  toJSON(message: ConnectionStatus): unknown {
    const obj: any = {};
    if (message.name !== 0) {
      obj.name = connectionNameToJSON(message.name);
    }
    if (message.isActive === true) {
      obj.isActive = message.isActive;
    }
    if (message.type !== 0) {
      obj.type = connectionTypeToJSON(message.type);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<ConnectionStatus>, I>>(base?: I): ConnectionStatus {
    return ConnectionStatus.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<ConnectionStatus>, I>>(object: I): ConnectionStatus {
    const message = createBaseConnectionStatus();
    message.name = object.name ?? 0;
    message.isActive = object.isActive ?? false;
    message.type = object.type ?? 0;
    return message;
  },
};

function createBaseATConnectionInfo(): ATConnectionInfo {
  return { lat: 0, lon: 0, direction: 0, log: "" };
}

export const ATConnectionInfo = {
  encode(message: ATConnectionInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.lat !== 0) {
      writer.uint32(13).float(message.lat);
    }
    if (message.lon !== 0) {
      writer.uint32(21).float(message.lon);
    }
    if (message.direction !== 0) {
      writer.uint32(29).float(message.direction);
    }
    if (message.log !== "") {
      writer.uint32(34).string(message.log);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ATConnectionInfo {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseATConnectionInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 13) {
            break;
          }

          message.lat = reader.float();
          continue;
        case 2:
          if (tag !== 21) {
            break;
          }

          message.lon = reader.float();
          continue;
        case 3:
          if (tag !== 29) {
            break;
          }

          message.direction = reader.float();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.log = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): ATConnectionInfo {
    return {
      lat: isSet(object.lat) ? globalThis.Number(object.lat) : 0,
      lon: isSet(object.lon) ? globalThis.Number(object.lon) : 0,
      direction: isSet(object.direction) ? globalThis.Number(object.direction) : 0,
      log: isSet(object.log) ? globalThis.String(object.log) : "",
    };
  },

  toJSON(message: ATConnectionInfo): unknown {
    const obj: any = {};
    if (message.lat !== 0) {
      obj.lat = message.lat;
    }
    if (message.lon !== 0) {
      obj.lon = message.lon;
    }
    if (message.direction !== 0) {
      obj.direction = message.direction;
    }
    if (message.log !== "") {
      obj.log = message.log;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<ATConnectionInfo>, I>>(base?: I): ATConnectionInfo {
    return ATConnectionInfo.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<ATConnectionInfo>, I>>(object: I): ATConnectionInfo {
    const message = createBaseATConnectionInfo();
    message.lat = object.lat ?? 0;
    message.lon = object.lon ?? 0;
    message.direction = object.direction ?? 0;
    message.log = object.log ?? "";
    return message;
  },
};

function createBaseOBCConnectionInfo(): OBCConnectionInfo {
  return { mavHeartbeat: 0, cameraConnected: false };
}

export const OBCConnectionInfo = {
  encode(message: OBCConnectionInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.mavHeartbeat !== 0) {
      writer.uint32(13).float(message.mavHeartbeat);
    }
    if (message.cameraConnected === true) {
      writer.uint32(16).bool(message.cameraConnected);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): OBCConnectionInfo {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseOBCConnectionInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 13) {
            break;
          }

          message.mavHeartbeat = reader.float();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.cameraConnected = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): OBCConnectionInfo {
    return {
      mavHeartbeat: isSet(object.mavHeartbeat) ? globalThis.Number(object.mavHeartbeat) : 0,
      cameraConnected: isSet(object.cameraConnected) ? globalThis.Boolean(object.cameraConnected) : false,
    };
  },

  toJSON(message: OBCConnectionInfo): unknown {
    const obj: any = {};
    if (message.mavHeartbeat !== 0) {
      obj.mavHeartbeat = message.mavHeartbeat;
    }
    if (message.cameraConnected === true) {
      obj.cameraConnected = message.cameraConnected;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<OBCConnectionInfo>, I>>(base?: I): OBCConnectionInfo {
    return OBCConnectionInfo.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<OBCConnectionInfo>, I>>(object: I): OBCConnectionInfo {
    const message = createBaseOBCConnectionInfo();
    message.mavHeartbeat = object.mavHeartbeat ?? 0;
    message.cameraConnected = object.cameraConnected ?? false;
    return message;
  },
};

function createBaseRMavConnectionInfo(): RMavConnectionInfo {
  return { mavHeartbeat: 0 };
}

export const RMavConnectionInfo = {
  encode(message: RMavConnectionInfo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.mavHeartbeat !== 0) {
      writer.uint32(13).float(message.mavHeartbeat);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): RMavConnectionInfo {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseRMavConnectionInfo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 13) {
            break;
          }

          message.mavHeartbeat = reader.float();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): RMavConnectionInfo {
    return { mavHeartbeat: isSet(object.mavHeartbeat) ? globalThis.Number(object.mavHeartbeat) : 0 };
  },

  toJSON(message: RMavConnectionInfo): unknown {
    const obj: any = {};
    if (message.mavHeartbeat !== 0) {
      obj.mavHeartbeat = message.mavHeartbeat;
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<RMavConnectionInfo>, I>>(base?: I): RMavConnectionInfo {
    return RMavConnectionInfo.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<RMavConnectionInfo>, I>>(object: I): RMavConnectionInfo {
    const message = createBaseRMavConnectionInfo();
    message.mavHeartbeat = object.mavHeartbeat ?? 0;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
