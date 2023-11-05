import {MapContainer, TileLayer } from "react-leaflet"
import 'leaflet/dist/leaflet.css'

/**
 * Wrapper component around all leaflet maps for the application. Any functionality we do with leaflet should be encased
 * within this class, so that we don't have repeated leaflet code throughout all the files.
 * @param props Props
 * @param props.className class to apply to the map
 * @param props.lat starting latitude of the map
 * @param props.lng starting longitude of the map
 * @returns TuasMap wrapper component
 */
function TuasMap({className, lat, lng}:{className: string, lat: number, lng: number}) {
    return (
        <>
            <MapContainer className={className} center={[lat, lng]} zoom={13} scrollWheelZoom={false}>
                <TileLayer
                    attribution='Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>'
                    url="https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}"
                    accessToken="pk.eyJ1IjoidGxlbnR6IiwiYSI6ImNsM2dwNmwzczBrb24zaXcxcWNoNWZjMjQifQ.sgAV6vkF7vOLC4P1_WkV_w"
                    tileSize={512}
                    zoomOffset={-1}
                    id= 'mapbox/satellite-v9'
                />
            </MapContainer>
        </>
    );
}

export default TuasMap;