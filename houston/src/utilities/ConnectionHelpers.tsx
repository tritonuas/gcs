import ethernetConnected from "../assets/ethernet-connected.svg"
import ethernetDisconnected from "../assets/ethernet-disconnected.svg"
import radioConnected from "../assets/radio-connected.svg"
import radioDisconnected from "../assets/radio-disconnected.svg"
import wifiConnected from "../assets/wifi-connected.svg"
import wifiDisconnected from "../assets/wifi-disconnected.svg"

import {ConnectionStatus, ConnectionType} from "../pages/Connection"

import {Link} from 'react-router-dom'

/**
 * Takes information about a connection and returns the svg icon for it.
 * @param status Object containing all of the information regarding the collection.
 * @param i For use when rendering as part of list. Used for React key property.
 * @returns <img> tag with the correct class names and svg image.
 */
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

/**
 * Takes a connection status and formats nice looking link for display inside of an <li>.
 * @param status Object containing the connection status information
 * @param i Used for the key prop, since this will always be rendered as part of a list.
 * @returns <li> with <Link> inside of it that sends to correct connection status page
 */
export function statusToLink(status: ConnectionStatus, i: number) {
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