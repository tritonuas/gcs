import { useEffect } from "react";
import { useMap } from "react-leaflet";

function UpdateMapCenter({planeLatLng}:{planeLatLng: [number, number]}){
    const map = useMap();

    useEffect(() => {
        map.setView(planeLatLng);
    }, [planeLatLng, map]);

    return null;
}

export default UpdateMapCenter;