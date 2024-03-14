import { Dispatch, SetStateAction } from "react";
import { roundDecimal } from "./general";
import type { Parameter } from "../pages/Control";

const DECIMAL_PLACES = 1;
const METERS_PER_SECOND_TO_KNOTS = (meters: number) => meters * 1.944;
const METERS_TO_FEET = (meters: number) => meters * 3.281;
const FAHRENHEIT_TO_CELSIUS = (F: number) => (5.0/9.0) * (F-32);

export function pullTelemetry(
    setPlaneLatLng: Dispatch<SetStateAction<[number, number]>>,
    setAirspeedVal: Dispatch<SetStateAction<Parameter>>,
    setGroundspeedVal: Dispatch<SetStateAction<Parameter>>,
    setAltitudeMSLVal: Dispatch<SetStateAction<Parameter>>,
    setAltitudeAGLVal: Dispatch<SetStateAction<Parameter>>,
    setMotorBatteryVal: Dispatch<SetStateAction<Parameter>>,
    setPixhawkBatteryVal: Dispatch<SetStateAction<Parameter>>,
    setESCtemperatureVal: Dispatch<SetStateAction<Parameter>>,
) {
    fetch('/api/plane/telemetry?id=74&field=groundspeed,airspeed,heading')
        .then(resp => resp.json())
        .then(json => {
            const airspeed = roundDecimal(json['airspeed'], DECIMAL_PLACES);
            const groundspeed = roundDecimal(json['groundspeed'], DECIMAL_PLACES);
            setAirspeedVal((param) => param.getUpdatedValue(airspeed, METERS_PER_SECOND_TO_KNOTS));
            setGroundspeedVal((param) => param.getUpdatedValue(groundspeed, METERS_PER_SECOND_TO_KNOTS));
            // todo set heading
        })
        .catch(_ => {
            setAirspeedVal((param) => param.getErrorValue());
            setGroundspeedVal((param) => param.getErrorValue());
        })
    fetch('/api/plane/telemetry?id=33&field=lat,lon,alt,relative_alt')
        .then(resp => resp.json())
        .then(json => {
            const altitude = roundDecimal(json["alt"], DECIMAL_PLACES);
            const relative_altitude = roundDecimal(json["relative_alt"], DECIMAL_PLACES);
            const lat = parseInt(json["lat"])/10e6;
            const lng = parseInt(json["lon"])/10e6;
            setPlaneLatLng([lat, lng]);
            setAltitudeMSLVal(param => param.getUpdatedValue(altitude, METERS_TO_FEET));
            setAltitudeAGLVal(param => param.getUpdatedValue(relative_altitude, METERS_TO_FEET));
        })
        .catch(_ => {
            setAltitudeMSLVal(param => param.getErrorValue());
            setAltitudeAGLVal(param => param.getErrorValue());
            // todo figure out good error value for latlng so the map doesn't flicker to africa
        })
    fetch('/api/plane/telemetry?id=251&field=value')
        .then(resp => resp.json())
        .then(json => {
            const esc_temp = roundDecimal(json["value"], DECIMAL_PLACES);
            setESCtemperatureVal(param => param.getUpdatedValue(esc_temp, FAHRENHEIT_TO_CELSIUS));
        })
        .catch(_ => {
            setESCtemperatureVal(param => param.getErrorValue());
        })
    fetch('/api/plane/voltage')
        .then(resp => resp.json())
        .then(json => {
            let pixhawkV = roundDecimal(json["0"]/1000,DECIMAL_PLACES);
            let motorV = roundDecimal(json["1"]/1000,DECIMAL_PLACES);

            setPixhawkBatteryVal(param => param.getUpdatedValue(pixhawkV, (x) => x));
            setMotorBatteryVal(param => param.getUpdatedValue(motorV, (x) => x));
        })
        .catch(_ => {
            setPixhawkBatteryVal(param => param.getErrorValue());
            setMotorBatteryVal(param => param.getErrorValue());
        });
}