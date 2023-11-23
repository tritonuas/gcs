import { MapContainer, Popup, TileLayer, Marker } from "react-leaflet"
import 'leaflet/dist/leaflet.css'
import { Icon } from 'leaflet';
import { item } from "../pages/Report.tsx"

/**
 * Wrapper component around all leaflet maps for the application. Any functionality we do with leaflet should be encased
 * within this class, so that we don't have repeated leaflet code throughout all the files.
 * @param props Props
 * @param props.className class to apply to the map
 * @param props.lat starting latitude of the map
 * @param props.lng starting longitude of the map
 * @param props.popupArray array of items to display on the map
 * @param props.icons array of icons to display on the map
 * @returns TuasMap wrapper component
 */
function TuasMap({className, lat, lng, popupArray, icons}:{className: string, lat: number, lng: number, popupArray: item[], icons: Icon[]}) {      
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
                {popupArray.map((marker) => (
                    <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={icons[popupArray.indexOf(marker)]}>
                        <Popup className={marker.alphanumeric+marker.alphanumericColor+marker.shape+marker.shapeColor}>{marker.alphanumeric+marker.alphanumericColor+marker.shape+marker.shapeColor}</Popup>
                    </Marker>
                ))}
            </MapContainer>
        </>
    );
}

export default TuasMap;