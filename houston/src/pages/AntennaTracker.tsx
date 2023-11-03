import {useState, useEffect} from 'react'
import {MapContainer, TileLayer, } from "react-leaflet"
import "./AntennaTracker.css"
import 'leaflet/dist/leaflet.css'

/**
 * This page displays all of the relevant connection information for the Antenna Tracker.
 * It displays this with a map that shows the antenna tracker pointing towards the plane's
 * current location. It also has a terminal which displays the raw UDP frames being sent
 * over the wire. Eventually, it will take in props which provide the connection status information.
 * @returns Component representing page for the Antenna Tracker Connection Status
 */
function AntennaTracker() {
    const [terminalText, setTerminalText] = useState("");

    // For testing so text is constantly being added to the terminal
    useEffect(() => {
        const interval = setInterval(() => {
            // Update the text
            const date = new Date();
            setTerminalText(txt => `${txt}\n${date.toString()}`);

            // Scroll the <pre>
            const pre = document.getElementById("atracker-pre");
            if (pre != null) {
                pre.scrollTop = pre?.scrollHeight;
            }
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <main className="atracker-page">
                <MapContainer className={"atracker-map"} center={[51.505, -0.09]} zoom={13} scrollWheelZoom={false}>
                    <TileLayer
                        attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
                        url="https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}"
                        accessToken="pk.eyJ1IjoidGxlbnR6IiwiYSI6ImNsM2dwNmwzczBrb24zaXcxcWNoNWZjMjQifQ.sgAV6vkF7vOLC4P1_WkV_w"
                        tileSize={512}
                        zoomOffset={-1}
                        id= 'mapbox/satellite-v9'
                    />
                </MapContainer>
                <div className="atracker-terminal">
                    <pre id="atracker-pre"> {terminalText} </pre>
                </div>
            </main>
        </>
    );
}
export default AntennaTracker;