import { roundDecimal, connectToLocationWorker, getCurrPos, getPosHistory, confirmDialog, alertDialog, clearPosHistory, getHubIp, getHubPort, closeWaitDialogs, waitDialog, formatHubURL} from "./util.js";

let locationWorker = connectToLocationWorker();

// Global booleans
let centerOnPlane = true;
let tracePath = true;

function getCurrLatlng() {
    let currPos = getCurrPos();
    if (currPos != null) {
        return [currPos.latitude, currPos.longitude];
    } else {
        return [0,0];
    }
}

function updatePlaneMarker() {
    let map = document.getElementById("map");
    let currPos = getCurrPos();
    if (currPos != null) {
        let latlng = getCurrLatlng();
        map.moveMarker("plane", latlng);
        if (centerOnPlane) {
            map.centerMap(latlng);
        }
        if (tracePath) {
            // TODO: detect change in previous flight point
            map.addPointToPoly("taken-path", latlng);
        }
    } else {
        map.setNoConn();
    }
}

// Set up and initialize the map
function initMap() {
    let map = document.getElementById("map");

    map.initPoly("boundaries", "red", false);
    map.initPoly("search", "magenta", false);
    map.initPoly("planned-path", "cyan", true);
    map.initPoly("taken-path", "yellow", true);
    map.initMarker("plane", getCurrLatlng(), "../images/plane.gif", [32, 32]);
    // TODO: list of markers for waypoints

    setInterval(updatePlaneMarker, 1000);
}

// Set up everything relating to controlling the map
function setUpMapControlForm() {
    let mapControlForm = document.getElementById('map-control-form');
    mapControlForm.addEventListener('submit', (e) => {
        e.preventDefault();
    }) ;

    let tracePathCheckbox = document.getElementById('trace-path-checkbox');
    tracePathCheckbox.addEventListener('click', (e) => {
        tracePath = e.currentTarget.checked;
    });

    let centerPlaneCheckbox = document.getElementById('center-plane-checkbox');
    centerPlaneCheckbox.addEventListener('click', (e) => {
        centerOnPlane = e.currentTarget.checked;
    });
}

function setUpGauges() {
    let aspeedGauge = document.getElementById('aspeed-gauge');
    let gspeedGauge = document.getElementById('gspeed-gauge');
    let altGauge = document.getElementById('alt-gauge');
    let stateGauge = document.getElementById('state-gauge');
    let flightModeGauge = document.getElementById('flightmode-gauge');
    let escGauge = document.getElementById('esc-temp-gauge');
    let pixhawkGauge = document.getElementById('pixhawk-v-gauge');
    let motorGauge = document.getElementById('motor-v-gauge');

    const FLIGHT_MODE = {
        128: "Armed", 64: "Manual", 32: "HIL", 16: "Stabilize", 8: "Guided", 4: "Auto", 2: "Test", 1: "Custom"
    };

    let checkRequest = (r) => {
        if (!r.ok) {
            throw "Request not okay";
        }
        return r;
    };

    setInterval(() => {
        fetch(formatHubURL('/api/plane/telemetry?id=74&field=groundspeed,airspeed'))
            .then(r => checkRequest(r))
            .then(r => r.json())
            .then(json => {
                aspeedGauge.setValue(roundDecimal(json["airspeed"] * 1.944, 1)); // m/s -> knots
                gspeedGauge.setValue(roundDecimal(json["groundspeed"] * 1.944, 1)); // m/s -> knots
            })
            .catch(err => {
                aspeedGauge.setNull();
                gspeedGauge.setNull();
            });
        let currPos = getCurrPos();
        if (currPos == null) {
            altGauge.setNull();
        } else {
            altGauge.setValue(roundDecimal(currPos["altitude"] * 3.281), 1); // m -> ft
        }
        fetch(formatHubURL('/api/mission/state'))
            .then(r => checkRequest(r))
            .then(r => r.text())
            .then(text => {
                stateGauge.setValue(text);
            })
            .catch(err => {
                stateGauge.setNull();
            });
        fetch(formatHubURL('/api/plane/telemetry?id=0&field=base_mode'))
            .then(r => checkRequest(r))
            .then(r => r.json())
            .then(json => {
                flightModeGauge.setValue(FLIGHT_MODE[json["base_mode"]]);
            })
            .catch(err => {
                flightModeGauge.setNull();
            });
        fetch(formatHubURL('/api/plane/telemetry?id=251&field=value'))
            .then(r => checkRequest(r))
            .then(r => r.json())
            .then(json => {
                escGauge.setValue(roundDecimal(json["value"], 1));
            })
            .catch(err => {
                escGauge.setNull();
            });
        fetch(formatHubURL('/api/plane/voltage'))
            .then(r => checkRequest(r))
            .then(r => r.json())
            .then(json => {
                pixhawkGauge.setValue(roundDecimal(json["0"]/1000,1));
                motorGauge.setValue(roundDecimal(json["1"]/1000,1));
            })
            .catch(err => {
                pixhawkGauge.setNull();
                motorGauge.setNull();
            });
    }, 1000);
}

function setUpManualBottleDrop() {
    let swapInput = document.getElementById('swap-bottle-txt');
    const VALID_INPUT = ['A', 'B', 'C', 'D', 'E']
    swapInput.addEventListener('change', (e) => {
        e.target.value = e.target.value.toUpperCase();
        if (!(VALID_INPUT.includes(e.target.value))) {
            alertDialog("Input must be in " + VALID_INPUT, true);
            e.target.value = "";
        }
    });

    document.getElementById("swap-bottle-btn")
        .addEventListener('click', () => {
            if (swapInput.value != "") {
                fetch(formatHubURL("/api/mission/airdrop/manual/swap"), {
                    method: "POST",
                    body: JSON.stringify({bottle: swapInput.value}),
                    headers: {'content-type': 'application/json'}
                })
                    .then(r => r.text())
                    .then(text => {
                        alertDialog(text);
                    })
                    .catch(err => {
                        alertDialog(err, true);
                    });
            } else {
                alertDialog("Nothing selected in input", true);
            }
        });

    document.getElementById("drop-bottle-btn")
        .addEventListener('click', () => {
            fetch(formatHubURL("/api/mission/airdrop/manual/drop"), {
                method: "POST"
            })
                .then(r => r.text())
                .then(text => {
                    alertDialog(text);
                })
                .catch(err => {
                    alertDialog(err, true);
                });
        });
}

document.addEventListener('DOMContentLoaded', () => {
    setUpMapControlForm();
    setUpGauges();
    setUpManualBottleDrop();
});

window.addEventListener('load', () => {
    initMap();
});