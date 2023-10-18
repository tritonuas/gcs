import {FC, useState} from 'react'
import { DotPulse } from '@uiball/loaders'
import "./Connection.css"
import { Link } from 'react-router-dom'

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

import ethernetConnected from "../assets/ethernet-connected.svg"
import ethernetDisconnected from "../assets/ethernet-disconnected.svg"
import radioConnected from "../assets/radio-connected.svg"
import radioDisconnected from "../assets/radio-disconnected.svg"
import wifiConnected from "../assets/wifi-connected.svg"
import wifiDisconnected from "../assets/wifi-disconnected.svg"

export function getIconFromStatus(status: ConnectionStatus, i: number) {
        if (status.type == ConnectionType.Ethernet) {
            if (status.isActive) {
                return (<img key={i} className="svg active" src={ethernetConnected}></img>)
            } else {
                return (<img key={i} className="svg inactive" src={ethernetDisconnected}></img>)
            }
        } else if (status.type == ConnectionType.Radio) {
            if (status.isActive) {
                return (<img key={i} className="svg active" src={radioConnected}></img>)
            } else {
                return (<img key={i} className="svg inactive" src={radioDisconnected}></img>)
            }
        } else { // wifi
            if (status.isActive) {
                return (<img key={i} className="svg active" src={wifiConnected}></img>)
            } else {
                return (<img key={i} className="svg inactive" src={wifiDisconnected}></img>)
            }
        }
    }

function statusToJSX(status: ConnectionStatus, i: number) {
    return (
        <li key={i}>
            <Link className="conn-link" to={status.name.replace(/\s+/g, '').toLowerCase()}>
                <span className="conn-name">{status.name}</span>
                <span className={"conn-status"}>
                    {getIconFromStatus(status, i)}
                </span>
            </Link>
        </li>
    );
}

// TODO: allow clicking on each connection status item
// in order to see a more in depth description of that
// connectiontrue


// TODO: Pull connection info from gcs, use DotPulse waiting icon before 
// data has been pulled

function Connection({statuses}:{statuses:ConnectionStatus[]}) {

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