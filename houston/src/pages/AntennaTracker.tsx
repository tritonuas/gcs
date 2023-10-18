import {MapContainer, TileLayer, Marker, Popup} from "react-leaflet"
import "./AntennaTracker.css"
import 'leaflet/dist/leaflet.css'

function AntennaTracker() {
    return (
        <>
            <main className="atracker-page">
                <MapContainer style={{width: 600, height: 600}} center={[51.505, -0.09]} zoom={13} scrollWheelZoom={false}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[51.505, -0.09]}>
                        <Popup>
                        A pretty CSS3 popup. <br /> Easily customizable.
                        </Popup>
                    </Marker>
                </MapContainer>
            </main>
        </>
    );
}
export default AntennaTracker;