import { roundDecimal, connectToLocationWorker, getCurrPos, formatHubURL, checkRequest} from "./util.js";

let locationWorker = connectToLocationWorker();

// Global booleans
let centerOnPlane = true;
let tracePath = true;

// Ids for polys on the map
// match ids with request endpoints in Hub
const FLIGHT_BOUNDS = "mission/bounds/field";
const SEARCH_BOUNDS = "mission/bounds/airdrop";
const INITIAL_WAYPOINTS = "mission/waypoints";
const INITIAL_PATH = "mission/path/initial";
// In future this possibly will correspond with a route, but for now the caching is done client-side
const TAKEN_PATH = "taken-path";

function getCurrLatlng() {
    let currPos = getCurrPos();
    if (currPos != null) {
        return [currPos.latitude, currPos.longitude];
    } else {
        return [0,0];
    }
}

function updateMap() {
    let map = document.getElementById("map");
    let currPos = getCurrPos();
    if (currPos != null) {
        let latlng = getCurrLatlng();
        map.moveMarker("plane", latlng);
        if (centerOnPlane) {
            map.centerMap(latlng);
        }
        if (tracePath) {
            console.log("taken path:", latlng);
            map.addPointToPoly(TAKEN_PATH, latlng);
        }
    } else {
        map.setNoConn();
    }
}

// Set up and initialize the map
function initMap() {
    let map = document.getElementById("map");


    map.initPoly(FLIGHT_BOUNDS, "red", false);
    map.initPoly(SEARCH_BOUNDS, "magenta", false);
    map.initPoly(INITIAL_WAYPOINTS, "blue", true);
    map.initPoly(INITIAL_PATH, "yellow", true); 
    map.initPoly(TAKEN_PATH, "cyan", true);
    
    function draw() {
        for (let i = 0; i < arguments.length; i++) {
            let id = arguments[i];
            fetch(formatHubURL(`/api/${arguments[i]}`))
                .then(r => checkRequest(r))
                .then(r => r.json())
                .then(list => {
                    let latlngs = [];
                    for (const pt of list) {
                        latlngs.push([pt.latitude, pt.longitude]);
                    }
                    map.addPointsToPoly(id, latlngs);
                })
        }
    };
    draw(FLIGHT_BOUNDS, SEARCH_BOUNDS, INITIAL_WAYPOINTS, INITIAL_PATH);


    map.initMarker("plane", getCurrLatlng(), "../images/toothless.gif", [36, 36]);
    // TODO: list of markers for waypoints

    setInterval(updateMap, 1000);
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
        if (!tracePath) {
            let map = document.getElementById('map');
            if (map.isInitialized()) {
                map.disconnectPoly("taken-path");
            }
        }
    });

    let centerPlaneCheckbox = document.getElementById('center-plane-checkbox');
    centerPlaneCheckbox.addEventListener('click', (e) => {
        centerOnPlane = e.currentTarget.checked;
    });

    let saveMapButton = document.getElementById('save-map-button');
    saveMapButton.addEventListener('click', () => {
        let map = document.getElementById("map");
        map.serialize();
    });
}

function setUpGauges() {
    let aspeedGauge = document.getElementById('aspeed-gauge');
    let gspeedGauge = document.getElementById('gspeed-gauge');
    let altGauge = document.getElementById('alt-gauge');
    let headingGauge = document.getElementById('heading-gauge');
    let altAglGauge = document.getElementById('alt-agl-gauge');
    let stateGauge = document.getElementById('state-gauge');
    let flightModeGauge = document.getElementById('flightmode-gauge');
    let escGauge = document.getElementById('esc-temp-gauge');
    let pixhawkGauge = document.getElementById('pixhawk-v-gauge');
    let motorGauge = document.getElementById('motor-v-gauge');

    const FLIGHT_MODE = {
        128: "Armed", 64: "Manual", 32: "HIL", 16: "Stabilize", 8: "Guided", 4: "Auto", 2: "Test", 1: "Custom"
    };


    setInterval(() => {
        fetch(formatHubURL('/api/plane/telemetry?id=74&field=groundspeed,airspeed, heading'))
            .then(r => checkRequest(r))
            .then(r => r.json())
            .then(json => {
                aspeedGauge.setValue(roundDecimal(json["airspeed"] * 1.944, 1)); // m/s -> knots
                gspeedGauge.setValue(roundDecimal(json["groundspeed"] * 1.944, 1)); // m/s -> knots
                headingGauge.setValue(parseInt(json["heading"])) // 0 deg = north
            })
            .catch(err => {
                aspeedGauge.setNull();
                gspeedGauge.setNull();
                headingGauge.setNull();
            });
        let currPos = getCurrPos();
        if (currPos == null) {
            altGauge.setNull();
            altAglGauge.setNull()
        } else {
            altGauge.setValue(roundDecimal(currPos["altitude"] * 3.281), 1); // m -> ft
            altAglGauge.setValue(roundDecimal(currPos["relative_alt"] / 304.8), 1); // mm -> ft
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
    }, 1000);

    setInterval(() => {
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
    }, 2000);
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
    //setUpManualBottleDrop();
});

window.addEventListener('load', () => {
    initMap();
});