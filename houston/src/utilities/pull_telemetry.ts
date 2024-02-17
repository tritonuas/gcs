import { Dispatch, SetStateAction } from "react";
import type { Parameter } from "../pages/Control";
import { MM_TO_METERS, FAHRENHEIT_TO_CELSIUS, METERS_PER_SECOND_TO_KNOTS, METERS_TO_FEET } from "./general";
import { SettingsConfig } from "./settings";

/**
 * Helper function to get all of the necessary telemetry information from the backend
 * @param settings Settings, for battery cell amounts
 * @param setPlaneLatLng state setter
 * @param setAirspeedVal state setter
 * @param setGroundspeedVal state setter
 * @param setAltitudeMSLVal state setter
 * @param setAltitudeAGLVal state setter
 * @param setMotorBatteryVal state setter
 * @param setPixhawkBatteryVal state setter
 * @param setESCtemperatureVal state setter
 * @param setSuperSecret state setter
 */
export function pullTelemetry(
    settings: SettingsConfig,
    setPlaneLatLng: Dispatch<SetStateAction<[number, number]>>,
    setAirspeedVal: Dispatch<SetStateAction<Parameter>>,
    setGroundspeedVal: Dispatch<SetStateAction<Parameter>>,
    setAltitudeMSLVal: Dispatch<SetStateAction<Parameter>>,
    setAltitudeAGLVal: Dispatch<SetStateAction<Parameter>>,
    setMotorBatteryVal: Dispatch<SetStateAction<Parameter>>,
    setPixhawkBatteryVal: Dispatch<SetStateAction<Parameter>>,
    setESCtemperatureVal: Dispatch<SetStateAction<Parameter>>,
    setSuperSecret: Dispatch<SetStateAction<boolean>>,
) {
    fetch('/api/plane/telemetry?id=74&field=groundspeed,airspeed,heading')
        .then(resp => resp.json())
        .then(json => {
            const airspeed = json['airspeed'];
            const groundspeed = json['groundspeed'];
            setAirspeedVal((param) => param.getUpdatedValue(airspeed, METERS_PER_SECOND_TO_KNOTS));
            setGroundspeedVal((param) => param.getUpdatedValue(groundspeed, METERS_PER_SECOND_TO_KNOTS));
            // todo set heading
        })
        .catch(_ => {
            setAirspeedVal((param) => param.getErrorValue());
            setGroundspeedVal((param) => param.getErrorValue());
            setSuperSecret(true);
        })
    fetch('/api/plane/telemetry?id=33&field=lat,lon,alt,relative_alt')
        .then(resp => resp.json())
        .then(json => {
            const altitude = MM_TO_METERS(json["alt"]);
            const relative_altitude = MM_TO_METERS(json["relative_alt"]);
            const lat = parseFloat(json["lat"]);
            const lng = parseFloat(json["lng"]);
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
            const esc_temp = json["value"];
            setESCtemperatureVal(param => param.getUpdatedValue(esc_temp, FAHRENHEIT_TO_CELSIUS));
        })
        .catch(_ => {
            setESCtemperatureVal(param => param.getErrorValue());
        })
    fetch('/api/plane/voltage')
        .then(resp => resp.json())
        .then(json => {
            const pixhawkV = json["0"]/1000; //kV -> V
            const motorV = json["1"]/1000;

            const PIXHAWK_CELLS = settings.pixhawkBatteryCells;
            const MOTOR_CELLS = settings.motorBatteryCells;
            setPixhawkBatteryVal(param => param.getUpdatedValue(pixhawkV, (x) => x / PIXHAWK_CELLS));
            setMotorBatteryVal(param => param.getUpdatedValue(motorV, (x) => x / MOTOR_CELLS));
        })
        .catch(_ => {
            setPixhawkBatteryVal(param => param.getErrorValue());
            setMotorBatteryVal(param => param.getErrorValue());
        });
}