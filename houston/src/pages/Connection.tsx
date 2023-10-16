import {FC, useState} from 'react'
import { DotPulse } from '@uiball/loaders'
import "./Connection.css"

// TODO: standardize connection status data structure
// and make it a protobuf
interface ConnectionStatus {
    name: string,
    isActive: boolean
    type: ConnectionType
}

enum ConnectionType {
    Radio,
    Ethernet,
    Wifi
}

import ethernetConnected from "../assets/ethernet-connected.svg"
import ethernetDisconnected from "../assets/ethernet-disconnected.svg"
import radioConnected from "../assets/radio-connected.svg"
import radioDisconnected from "../assets/radio-disconnected.svg"
import wifiConnected from "../assets/wifi-connected.svg"
import wifiDisconnected from "../assets/wifi-disconnected.svg"

// TODO: allow clicking on each connection status item
// in order to see a more in depth description of that
// connectiontrue


// TODO: Pull connection info from gcs, use DotPulse waiting icon before 
// data has been pulled

const Connection: FC = () => {
    const [statuses, setStatuses] = useState<ConnectionStatus[]>([
        {name: "Antenna Tracker", isActive: true, type: ConnectionType.Ethernet} as ConnectionStatus,
        {name: "Onboard Computer", isActive: true, type: ConnectionType.Wifi} as ConnectionStatus,
        {name: "Radio Mavlink", isActive: true, type: ConnectionType.Radio} as ConnectionStatus,
    ]);

    function getIconFromStatus(status: ConnectionStatus) {
        if (status.type == ConnectionType.Ethernet) {
            if (status.isActive) {
                return (<img src={ethernetConnected}></img>)
            } else {
                return (<> <img src={ethernetDisconnected}></img> </>)
            }
        } else if (status.type == ConnectionType.Radio) {
            if (status.isActive) {
                return (<img src={radioConnected}></img>)
            } else {
                return (<img src={radioDisconnected}></img>)
            }
        } else { // wifi
            if (status.isActive) {
                return (<img src={wifiConnected}></img>)
            } else {
                return (<img src={wifiDisconnected}></img>)
            }
        }
    }

    function statusToJSX(status: ConnectionStatus, i: number) {
        return (
            <li key={i}>
                <span className="conn-name">{status.name}</span>
                <span className={"conn-status " + (status.isActive ? "active" : "inactive")}>
                    {getIconFromStatus(status)}
                </span>
            </li>
        );
    }

    return (
        <>
            <main className="connection-page">
                <ul>
                    {statuses.map(statusToJSX)} 
                </ul>
            </main>
        </>
    );
}

export default Connection;