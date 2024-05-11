import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * @param props props
 * @param props.position the coordiantes to center the map on
 * @returns UpdateMapCenter component
 */
function UpdateMapCenter({position}:{position: [number, number]}){
    const map = useMap();

    useEffect(() => {
        map.setView(position);
    }, [position]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}

export default UpdateMapCenter;