import { Dispatch, SetStateAction } from "react";
import { roundDecimal } from "./general";

const DECIMAL_PLACES = 1;
const METERS_PER_SECOND_TO_KNOTS = 1.944;
const METERS_TO_FEET = 3.281;

export function pullTelemetry(
    setPlaneLatLng: Dispatch<SetStateAction<number[]>>,
    setAirspeedValue: Dispatch<SetStateAction<number[]>>,
    setGroundspeedValue: Dispatch<SetStateAction<number[]>>,
    setAltitudeMSLValue: Dispatch<SetStateAction<number[]>>,
    setAltitudeAGLValue: Dispatch<SetStateAction<number[]>>,
    setMotorBatteryVal: Dispatch<SetStateAction<number[]>>,
    setPixhawkBatteryVal: Dispatch<SetStateAction<number[]>>,
    setESCtemperatureVal: Dispatch<SetStateAction<number[]>>,
) {
    fetch('/api/plane/telemetry?id=74&field=groundspeed,airspeed,heading')
        .then(resp => resp.json())
        .then(json => {
            const airspeed = roundDecimal(json['airspeed'], DECIMAL_PLACES);
            const groundspeed = roundDecimal(json['groundspeed'], DECIMAL_PLACES);
            setAirspeedValue([airspeed, airspeed * METERS_PER_SECOND_TO_KNOTS]);
            setGroundspeedValue([groundspeed, groundspeed * METERS_PER_SECOND_TO_KNOTS]);
            // todo set heading
        })
        .catch(_ => {
            setAirspeedValue([0,0]);
            setGroundspeedValue([0,0]);
        })
    fetch('/api/plane/telemetry?id=33&field=lat,lon,alt,relative_alt')
        .then(resp => resp.json())
        .then(json => {
            const altitude = roundDecimal(json["alt"], DECIMAL_PLACES);
            const relative_altitude = roundDecimal(json["relative_alt"], DECIMAL_PLACES);
            const lat = parseFloat(json["lat"]);
            const lng = parseFloat(json["lng"]);
            setPlaneLatLng([lat, lng]);
            setAltitudeMSLValue([altitude, altitude * METERS_TO_FEET])
            setAltitudeAGLValue([relative_altitude, relative_altitude * METERS_TO_FEET]);

        })
        .catch(_ => {
            setAltitudeMSLValue([0, 0])
            setAltitudeAGLValue([0, 0]);
            // todo figure out good error value for latlng so the map doesn't flicker to africa
        })
    fetch('/api/plane/telemetry?id=251&field=value')
        .then(resp => resp.json())
        .then(json => {
            const esc_temp = roundDecimal(json["value"], DECIMAL_PLACES);
            setESCtemperatureVal([esc_temp, 0]); // TODO: figure out what this is being sent as
        })
        .catch(_ => {
            setESCtemperatureVal([0,0]);
        })
    fetch('/api/plane/voltage')
        .then(resp => resp.json())
        .then(json => {
            let pixhawkV = roundDecimal(json["0"]/1000,DECIMAL_PLACES);
            let motorV = roundDecimal(json["1"]/1000,DECIMAL_PLACES);

            setPixhawkBatteryVal([pixhawkV, pixhawkV]);
            setMotorBatteryVal([motorV, motorV]);
        })
        .catch(_ => {
            setPixhawkBatteryVal([0, 0]);
            setMotorBatteryVal([0, 0]);
        });

}