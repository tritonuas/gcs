import { roundDecimal, connectToLocationWorker, getCurrPos, formatHubURL, checkRequest, speak} from "./util.js";

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


    // map.initMarker("plane", getCurrLatlng(), "../images/toothless.gif", [36, 36]);
    map.initMarker("plane", getCurrLatlng(), "../images/empty.png", [36, 36]);
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
    let warningToggle = document.getElementById("warning-toggle");

    // chat gpt did this gauge lol
    const canvas = document.getElementById('heading-canvas');
    const context = canvas.getContext('2d');

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;

    function drawGauge(heading) {
        // Clear the canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Draw the background
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        context.fillStyle = '#f2f2f2';
        context.fill();

        if (heading != null) {
            // Draw the compass needle
            context.save();
            context.translate(centerX, centerY);
            context.rotate((heading) * Math.PI / 180);
            context.beginPath();
            context.moveTo(0, -radius * 0.8);
            context.lineTo(0, radius * 0.1);
            context.lineWidth = 10;
            context.strokeStyle = '#4286f4';
            context.stroke();
            context.restore();

            // Update heading on the actual plane icon in the page
            document.getElementById('real-plane-icon')
                .style.transform = `rotate(${heading + 45}deg`;
        }

        // Draw the cardinal direction labels
        context.font = '16px Fira-Sans';
        context.fillStyle = '#000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('N', centerX, centerY - radius * 0.8);
        context.fillText('E', centerX + radius * 0.8, centerY);
        context.fillText('S', centerX, centerY + radius * 0.8);
        context.fillText('W', centerX - radius * 0.8, centerY);

        // Draw the heading value label
        context.font = '12px Fira-Sans';
        context.fillStyle = '#000';
        context.textAlign = 'center';
        context.fillText(`Heading: ${heading}°`, centerX, centerY + radius * 0.4);
    }
    drawGauge(null);


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
                drawGauge(parseInt(json["heading"]))
                // headingGauge.setValue(parseInt(json["heading"])) // 0 deg = north
            })
            .catch(err => {
                aspeedGauge.setNull();
                gspeedGauge.setNull();
                drawGauge(null);
            });
        let currPos = getCurrPos();
        if (currPos == null) {
            altGauge.setNull();
            altAglGauge.setNull()
        } else {
            altGauge.setValue(roundDecimal(currPos["altitude"] * 3.281), 1); // m -> ft
            let relAlt = roundDecimal(currPos["relative_alt"] / 304.8); // mm -> ft
            altAglGauge.setValue(relAlt);
            if (relAlt < 75 && warningToggle.checked) {
                speak("Low Altitude!");
            }
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
                let pixhawkV = roundDecimal(json["0"]/1000,1);
                let motorV = roundDecimal(json["1"]/1000,1);

                if (pixhawkV < 14.8 && warningToggle.checked) {
                    speak("Pixhawk battery low!");
                }
                if (motorV < 28.8 && warningToggle.checked) {
                    speak("Motor battery low!");
                }

                pixhawkGauge.setValue(pixhawkV);
                motorGauge.setValue(motorV);
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

    let test = document.createElement('img');
    test.id = "real-plane-icon";
    test.width = 36;
    test.height = 36;
    test.src = "../images/toothless.gif";
    test.style = 'position: absolute; z-index: 1000000000;';
    document.getElementsByTagName("body")[0].appendChild(test);

    setInterval(() => {
        let marker = document.getElementById("map").shadowRoot.querySelector(".leaflet-marker-icon");
        console.log(marker);
        let rect = marker.getBoundingClientRect();
        test.style.top = rect.top + 'px';
        test.style.left = rect.left + 'px';
    }, 150)
});