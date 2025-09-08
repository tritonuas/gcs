import { useState, useEffect } from "react";
import "./AntennaTracker.css";
import TuasMap from "../components/TuasMap";

import duck from "../assets/duck.png";

import { Marker } from "react-leaflet";
import L from "leaflet";

/**
 * A fuction that calculates the angle between two points.
 * @param plane The coordiantes for plane.
 * @param antenna The coordinates for the antenna.
 * @returns A number which represents the degree.
 */
// function calculateDegree(plane:[number, number], antenna:[number, number]): number{
//     //This offset number represents the the 0 degree if the bottom tip is the pointer.
//     const offSet = 217;

//     if(plane[0] >= antenna[0]){
//         const degreeRadian = Math.atan((plane[1]-antenna[1]) / (plane[0]-antenna[0]));
//         const degree = degreeRadian * 180 / Math.PI;
//         return (degree+offSet);
//     }
//     else{
//         const degreeRadian = Math.atan((plane[1]-antenna[1]) / (plane[0]-antenna[0]));
//         const degree = degreeRadian * 180 / Math.PI;
//         return (degree+180+offSet);
//     }
// }

/**
 * This page displays all of the relevant connection information for the Antenna Tracker.
 * It displays this with a map that shows the antenna tracker pointing towards the plane's
 * current location. It also has a terminal which displays the raw UDP frames being sent
 * over the wire. Eventually, it will take in props which provide the connection status information.
 * @param props props
 * @param props.planeLatLng The position of the plane.
 * @returns Component representing page for the Antenna Tracker Connection Status
 */
function AntennaTracker({ planeLatLng }: { planeLatLng: [number, number] }) {
  const [terminalText, setTerminalText] = useState<Array<string>>([]);
  const [rotation, setRotation] = useState(0);
  const [antennaLatLng] = useState<[number, number]>([0, 0]);
  const [antennaDirection] = useState<number>(0);
  const [icon, setIcon] = useState(localStorage.getItem("icon") || duck);
  const planeIcon = L.icon({
    iconUrl: icon,
    iconSize: [65, 50],
    iconAnchor: [32, 25],
  });
  const handleStorageChange = () => {
    const data = localStorage.getItem("icon");
    data ? setIcon(data) : setIcon(duck);
  };

  // For testing so text is constantly being added to the terminal
  useEffect(() => {
    const interval = setInterval(() => {
      // Update the text
      const date = new Date();
      setTerminalText((txt) => [`${date.toString()}`].concat(txt));

      // const pre = document.querySelector(".atracker-terminal");
      // if (pre != null) {
      //     pre.scrollTop = pre?.scrollHeight;
      // }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.addEventListener("storage", () => {
      handleStorageChange();
    });
    window.dispatchEvent(new Event("storage"));
    return () => {
      window.removeEventListener("storage", () => {
        handleStorageChange();
      });
    };
  });

  useEffect(() => {
    /* This calcualtes the angle if antenna was tracking where the plane is. */
    // setRotation(calculateDegree(planeLatLng, antennaLatLng));
    setRotation(antennaDirection + 217);
  }, [antennaDirection]);

  return (
    <>
      <main className="atracker-page">
        <TuasMap className="atracker-map" lat={51} lng={10}>
          <Marker position={planeLatLng} icon={planeIcon} />
          <Marker
            position={antennaLatLng}
            icon={
              new L.DivIcon({
                className: "",
                html:
                  "<img id='antenna-icon' style='--rotation: " +
                  rotation +
                  "deg;' src='../src/assets/banana.webp'/>",
                iconSize: [30, 42],
                iconAnchor: [15, 42],
              })
            }
          />
        </TuasMap>
        <div className="atracker-terminal">
          {terminalText.map((str, i) => (
            <p key={i}>{str}</p>
          ))}
        </div>
      </main>
    </>
  );
}

export default AntennaTracker;
