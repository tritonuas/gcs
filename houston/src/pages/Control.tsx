import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import TuasMap from "../components/TuasMap.tsx";
import duck from "../assets/duck.png";
import emergency_button from "../assets/emergency_button.webp";
import "./Control.css";
import { pullTelemetry } from "../utilities/pull_telemetry.ts";
import NOOOO from "../assets/noooo.gif";
import { SuperSecret } from "../components/SuperSecret.tsx";
import {
  CELSIUS_TO_FAHRENHEIT,
  FEET_TO_METERS,
  METERS_PER_SECOND_TO_KNOTS,
  roundDecimal,
} from "../utilities/general.tsx";
import { SettingsConfig } from "../utilities/settings.ts";
import UpdateMapCenter from "../components/UpdateMapCenter.tsx";

import CustomControl from "react-leaflet-custom-control";
import { Marker, Polygon, Polyline } from "react-leaflet";
import L, { LatLng } from "leaflet";
import { useMyModal } from "../components/UseMyModal.tsx";
import TakeoffSelector from "../components/TakeoffSelector.tsx";
import RTLSelector from "../components/RTLSelector.tsx";

type Unit = "knots" | "m/s" | "feet" | "meters" | "V" | "V/c" | "°F" | "°C" | "";
export type Threshold = [number, number, number, number];

export class Parameter {
  label: string;
  values: [number, number];
  value: number;
  units: [Unit, Unit];
  unit: Unit;
  color: React.CSSProperties;
  index: 0 | 1;
  error: boolean;

  // threshold:
  // - length = 4
  // - format: [lower bound value for unit[0], upper bound value for unit[0], lower bound value for unit[1], upper bound value for unit[1]]
  // - use:
  //      - to determine the color of the telemetry based on the current and threshold values.
  //      - if the current value is within the threshold, the color is green. if not, the color is red.
  threshold: Threshold;

  constructor(
    label: string,
    values: [number, number],
    units: [Unit, Unit],
    threshold: Threshold,
    index: 0 | 1,
    error: boolean = false,
  ) {
    this.label = label;
    this.values = values;
    this.units = units;
    this.value = values[index];
    this.unit = units[index];
    this.index = index;
    this.error = error;

    this.threshold = threshold;

    // figure out color
    // todo refactor
    if (this.error) {
      this.color = { backgroundColor: "var(--failure-text)" };
    } else {
      if (
        this.value >= threshold[values.indexOf(this.value) * 2] &&
        this.value <= threshold[values.indexOf(this.value) * 2 + 1]
      ) {
        this.color = { backgroundColor: "var(--success-text)" };
      } else {
        this.color = { backgroundColor: "var(--warning-text)" };
      }
    }
  }

  render(onClick: () => void) {
    if (this.error) {
      return (
        <div style={this.color} className="flight-telemetry" onClick={onClick}>
          <h1 className="heading">{this.label}</h1>
          <p className="data">
            {" "}
            <img className="error-icon" width={80} height={80} src={NOOOO} />
          </p>
          <div className="unit-indicator"></div>
        </div>
      );
    }

    if (this.units[0] !== this.units[1]) {
      let unit0_class = "unit-selected";
      let unit1_class = "unit-not-selected";

      if (this.unit !== this.units[0]) {
        [unit0_class, unit1_class] = [unit1_class, unit0_class]; // swap
      }

      return (
        <div style={this.color} className="flight-telemetry" onClick={onClick}>
          <h1 className="heading">{this.label}</h1>
          <p className="data">
            {roundDecimal(this.value)} {this.unit}
          </p>
          <div className="unit-indicator">
            <p className={`unit ${unit0_class}`}>{this.units[0]}</p>
            <p className={`unit ${unit1_class}`}>{this.units[1]}</p>
          </div>
        </div>
      );
    } else {
      return (
        <div style={this.color} className="flight-telemetry" onClick={onClick}>
          <h1 className="heading">{this.label}</h1>
          <p className="data">
            {roundDecimal(this.value)} {this.unit}
          </p>
        </div>
      );
    }
  }

  // Swaps the unit, but keeps all else constant
  // Returns new Parameter for use in react setState
  // does not mutate this Parameter
  getSwappedUnit(): Parameter {
    return new Parameter(
      this.label,
      this.values,
      this.units,
      this.threshold,
      this.index === 0 ? 1 : 0,
      this.error,
    );
  }

  // Updates the values, but keeps all else constant
  // Returns new Parameter for use in react setState
  // does not mutate this Parameter
  // Also wipes any error state
  getUpdatedValue(new_val: number, convert: (arg0: number) => number): Parameter {
    return new Parameter(
      this.label,
      [new_val, convert(new_val)],
      this.units,
      this.threshold,
      this.index,
      false,
    );
  }

  // Returns a parameter in the error state version of this Parameter
  // currently overrides the values to be 0,0 but maybe in the future
  // we will want to have it specified another way
  getErrorValue(): Parameter {
    return new Parameter(this.label, [0, 0], this.units, this.threshold, this.index, true);
  }
}

/**
 * A helper function to help with pushing an elemet to the end of an array of LatLng values.
 * @param setCoordinates React state setter for coordinates array.
 * @param planeLatLng A pair of LatLng coordiantes.
 */
function updateCoordinate(
  setCoordinates: React.Dispatch<React.SetStateAction<LatLng[]>>,
  planeLatLng: [number, number],
) {
  setCoordinates((coordinates) => [...coordinates, new LatLng(planeLatLng[0], planeLatLng[1])]);
}

/**
 * A helper functions that extracts out the get request and updates of flight bounds.
 * @param setFlightBound React state setter for Flight Bound variable.
 * @param setSearchBound React state setter for Search Bound variable.
 * @param setWayPoint React state setter for Way Point variable.
 */
function pullFlightBounds(
  setFlightBound: React.Dispatch<React.SetStateAction<LatLng[]>>,
  setSearchBound: React.Dispatch<React.SetStateAction<LatLng[]>>,
  setWayPoint: React.Dispatch<React.SetStateAction<LatLng[]>>,
) {
  fetch("/api/mission", {
    method: "GET",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Connecting");
      } else {
        return response.json();
      }
    })
    .then((data) => {
      if (Object.prototype.hasOwnProperty.call(data, "FlightBoundary")) {
        data["FlightBoundary"].map((coordinates: { Latitude: number; Longitude: number }) => {
          updateCoordinate(setFlightBound, [coordinates["Latitude"], coordinates["Longitude"]]);
        });
      }
      if (Object.prototype.hasOwnProperty.call(data, "AirdropBoundary")) {
        data["AirdropBoundary"].map((coordinates: { Latitude: number; Longitude: number }) => {
          updateCoordinate(setSearchBound, [coordinates["Latitude"], coordinates["Longitude"]]);
        });
      } //new
      if (Object.prototype.hasOwnProperty.call(data, "Waypoints")) {
        data["Waypoints"].map((coordinates: { Latitude: number; Longitude: number }) => {
          updateCoordinate(setWayPoint, [coordinates["Latitude"], coordinates["Longitude"]]);
        });
      }
    })
    .catch((error) => {
      console.error("Fetch error:", error);
    });
}

/**
 * control page
 * @param props props
 * @param props.settings Settings to determine thresholds and battery info
 * @param props.planeCoordinates Array of coordinates that the plane has passed through
 * @returns the control page
 */
function Control({
  settings,
  planeCoordinates,
}: {
  settings: SettingsConfig;
  planeCoordinates: LatLng[];
}) {
  const airspeedThreshold: Threshold = [
    settings.minAirspeed_m_s,
    settings.maxAirspeed_m_s,
    METERS_PER_SECOND_TO_KNOTS(settings.minAirspeed_m_s),
    METERS_PER_SECOND_TO_KNOTS(settings.maxAirspeed_m_s),
  ];

  const groundspeedThreshold = airspeedThreshold;

  //todo figure out way to deteect starting altitude so this has a valid range too
  const altitudeAGLThreshold: Threshold = [
    settings.minAltitudeAGL_feet,
    settings.maxAltitudeAGL_feet,
    FEET_TO_METERS(settings.minAltitudeAGL_feet),
    FEET_TO_METERS(settings.maxAltitudeAGL_feet),
  ];

  const altitudeMSLThreshold: Threshold = [
    settings.minAltitudeAGL_feet + settings.groundAltitude_feet,
    settings.maxAltitudeAGL_feet + settings.groundAltitude_feet,
    FEET_TO_METERS(settings.minAltitudeAGL_feet) + FEET_TO_METERS(settings.groundAltitude_feet),
    FEET_TO_METERS(settings.maxAltitudeAGL_feet) + FEET_TO_METERS(settings.groundAltitude_feet),
  ];

  const motorBatteryThreshold: Threshold = [
    settings.minVoltsPerCell,
    settings.maxVoltsPerCell,
    settings.minVoltsPerCell * settings.motorBatteryCells,
    settings.maxVoltsPerCell * settings.motorBatteryCells,
  ];

  const pixhawkBatteryThreshold: Threshold = [
    settings.minVoltsPerCell,
    settings.maxVoltsPerCell,
    settings.minVoltsPerCell * settings.pixhawkBatteryCells,
    settings.maxVoltsPerCell * settings.pixhawkBatteryCells,
  ];

  const ESCtemperatureThreshold: Threshold = [
    settings.minESCTemperature_c,
    settings.maxESCTemperature_c,
    CELSIUS_TO_FAHRENHEIT(settings.minESCTemperature_c),
    CELSIUS_TO_FAHRENHEIT(settings.maxESCTemperature_c),
  ];

  const [airspeed, setAirspeed] = useState<Parameter>(
    new Parameter("Airspeed", [0, 0], ["m/s", "knots"], airspeedThreshold, 0),
  );
  const [groundspeed, setGroundspeed] = useState<Parameter>(
    new Parameter("Groundspeed", [0, 0], ["m/s", "knots"], groundspeedThreshold, 0),
  );
  const [altitudeMSL, setAltitudeMSL] = useState<Parameter>(
    new Parameter("Altitude MSL", [0, 0], ["feet", "meters"], altitudeMSLThreshold, 0),
  );
  const [altitudeAGL, setAltitudeAGL] = useState<Parameter>(
    new Parameter("Altitude AGL", [0, 0], ["feet", "meters"], altitudeAGLThreshold, 0),
  );
  const [motorBattery, setMotorBattery] = useState<Parameter>(
    new Parameter("Motor Battery", [0, 0], ["V/c", "V"], motorBatteryThreshold, 0),
  );
  const [pixhawkBattery, setPixhawkBattery] = useState<Parameter>(
    new Parameter("Pixhawk Battery", [0, 0], ["V/c", "V"], pixhawkBatteryThreshold, 0),
  );
  const [ESCtemperature, setESCtemperature] = useState<Parameter>(
    new Parameter("ESC Temp", [0, 0], ["°C", "°F"], ESCtemperatureThreshold, 0),
  );

  const [planeLatLng, setPlaneLatLng] = useState<[number, number]>([0, 0]);
  const [icon, setIcon] = useState(localStorage.getItem("icon") || duck);
  const [flightBound, setFlightBound] = useState<LatLng[]>([]);
  const [searchBound, setSearchBound] = useState<LatLng[]>([]);
  const [wayPoint, setWayPoint] = useState<LatLng[]>([]);
  const markerIcon = L.icon({
    iconUrl: icon,
    iconSize: [65, 50],
    iconAnchor: [32, 25],
  });
  const [centerMap, setCenterMap] = useState(true);
  const { modalVisible, openModal, closeModal } = useMyModal();
  const {
    modalVisible: rtlModalVisible,
    openModal: openRTLModal,
    closeModal: closeRTLModal,
  } = useMyModal();

  const [superSecret, setSuperSecret] = useState(false);

  const [flightMode, setFlightMode] = useState("???");

  const [tickState, setTickState] = useState<string>("Loading...");

  // --- NEW useEffect specifically for fetching tick state ---
  useEffect(() => {
    const fetchTickState = () => {
      fetch("/api/tickstate")
        .then((response) => {
          if (!response.ok) {
            setTickState(`Error: ${response.status}`);
            throw new Error(`Tickstate fetch failed: ${response.status}`);
          }
          return response.text();
        })
        .then((data) => {
          setTickState(data);
        })
        .catch((error) => {
          console.error("Error fetching tick state:", error);
          setTickState("Error");
        });
    };

    fetchTickState(); // Fetch immediately on component mount
    const tickInterval = setInterval(fetchTickState, 1000); // Then fetch every second

    return () => {
      clearInterval(tickInterval); // Cleanup interval on component unmount
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  useEffect(() => {
    const interval = setInterval(
      () =>
        pullTelemetry(
          settings,
          setPlaneLatLng,
          setAirspeed,
          setGroundspeed,
          setAltitudeMSL,
          setAltitudeAGL,
          setMotorBattery,
          setPixhawkBattery,
          setESCtemperature,
          setSuperSecret,
          setFlightMode,
        ),
      1000,
    );

    return () => {
      clearInterval(interval);
    };
  }, [settings]);

  const flightModeColor = { backgroundColor: "var(--warning-text)" };

  const handleClick = (setter: Dispatch<SetStateAction<Parameter>>) => {
    setter((param) => param.getSwappedUnit());
  };

  const handleStorageChange = () => {
    const data = localStorage.getItem("icon");
    data ? setIcon(data) : setIcon(duck);
  };

  const handleEmergencyButton = () => {
    openModal();
  };

  const handleRTLButton = () => {
    openRTLModal();
  };

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
    pullFlightBounds(setFlightBound, setSearchBound, setWayPoint);
  }, []);

  return (
    <>
      <main className="controls-page">
        <div className="flight-telemetry-container">
          {airspeed.render(() => handleClick(setAirspeed))}
          {groundspeed.render(() => handleClick(setGroundspeed))}
          {altitudeMSL.render(() => handleClick(setAltitudeMSL))}
          {altitudeAGL.render(() => handleClick(setAltitudeAGL))}
        </div>
        {superSecret ? (
          <SuperSecret></SuperSecret>
        ) : (
          <TuasMap className={"map"} lat={planeLatLng[0]} lng={planeLatLng[1]}>
            <CustomControl prepend position="topright">
              <div className="checkbox-wrapper">
                <label className="control control--checkbox">
                  Center
                  <input
                    type="checkbox"
                    id="centerMapCheckBox"
                    checked={centerMap}
                    onClick={() => setCenterMap(!centerMap)}
                  />
                  <div className="control__indicator"></div>
                </label>
              </div>
            </CustomControl>
            <CustomControl prepend position="bottomright">
              <img
                src={emergency_button}
                alt="emergency button"
                width={"72px"}
                height={"72px"}
                style={{ cursor: "pointer" }}
                onClick={handleEmergencyButton}
              />
              <TakeoffSelector modalVisible={modalVisible} closeModal={closeModal} />
              <RTLSelector modalVisible={rtlModalVisible} closeModal={closeRTLModal} />
            </CustomControl>
            <CustomControl prepend position="bottomleft">
              <button
                className="rtl-button"
                onClick={handleRTLButton}
                style={{
                  background: "linear-gradient(-180deg, #FF6B6B, #C44569)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 15px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "bold",
                  boxShadow: "rgba(0, 0, 0, 0.1) 0 2px 4px",
                  transition: "box-shadow .2s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = "rgba(196, 69, 105, 0.5) 0 3px 8px";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = "rgba(0, 0, 0, 0.1) 0 2px 4px";
                }}
              >
                RTL
              </button>
            </CustomControl>
            {centerMap ? <UpdateMapCenter position={planeLatLng} /> : null}
            <Marker position={planeLatLng} icon={markerIcon} />
            <Polyline color="lime" positions={planeCoordinates} />
            <Polygon color="red" positions={flightBound} />
            <Polygon color="blue" positions={searchBound} />
            {wayPoint.map((latlng, index) => {
              return (
                <Marker
                  key={index}
                  position={latlng}
                  icon={
                    new L.DivIcon({
                      className: "custom-div-icon",
                      html:
                        "<div style='background-color:yellow;' class='marker-pin' data-content='" +
                        (index + 1) +
                        "'></div>",
                      iconSize: [30, 42],
                      iconAnchor: [15, 42],
                    })
                  }
                />
              );
            })}
          </TuasMap>
        )}
        <div className="flight-telemetry-container">
          <div style={flightModeColor} className="flight-telemetry" id="flight-mode">
            <h1 className="heading">Flight Mode</h1>
            <p className="data">{flightMode}</p>
          </div>
          <div style={flightModeColor} className="flight-telemetry" id="tick-state-display">
            <h1 className="heading">Tick State</h1>
            <p className="data">{tickState}</p>
          </div>
          {motorBattery.render(() => handleClick(setMotorBattery))}
          {pixhawkBattery.render(() => handleClick(setPixhawkBattery))}
          {ESCtemperature.render(() => handleClick(setESCtemperature))}
        </div>
      </main>
    </>
  );
}

export default Control;
