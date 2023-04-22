import {HUB_CONN_MSG, POS_HISTORY_MSG, CURR_POS_MSG} from "./util.js"

// TODO: cache the data when shut off in the future?

// Hub Connection Variables
let hubIp = null;
let hubPort = null;

// Location History variables
let posHistory = [];

// Helper functions for interacting with the posHistory
// If we ever want to make posHistory not just a local variable, then we will be happy to have
// these functions because then only these functions will need to change, and not every time 
// we interface with the posHistory list in the code
function getLastPos() {
    if (posHistory.length > 0) {
        return posHistory[posHistory.length - 1];
    } else {
        return null;
    }
}

// only adds to the pos history if it and the last pos are different
function addPosToHistory(telem) {
    let latestTelem = getLastPos();
    if (latestTelem !== null && !compareTelems(latestTelem, telem)) {
        posHistory.push(telem);
    } else if (latestTelem === null) {
        posHistory.push(telem);
    }
}

// Return true if they are the same position, false otherwise
// TODO: actually compare these so that we have
function compareTelems(telem1, telem2) {
    return telem1.lat === telem2.lat && telem1.lon === telem2.lon && telem1.alt === telem2.alt && telem1.hdg === telem2.hdg;
}

/*
convert from
{
    "lat": "[degE7]",
    "lon": "[degE7]",
    "alt": "[mm]",
    "hdg": "[cdeg]"
}
to
{
    "lat": "[degE7]",
    "lon": "[degE7]",
    "alt": "[mm]",
    "hdg": "[cdeg]",
    "latitude": [deg],
    "longitude": [deg],
    "altitude": [m],
    "heading": [deg]
}

This function both gets all the values in the right units, and converts them to numbers.
It also keeps the old number representations because these can be useful for operations
(like comparing if two telemetries are equal or not)
*/
function parseTelem(telem) {
    telem.latitude = parseFloat(telem.lat)/1e7;
    telem.longitude = parseFloat(telem.lon)/1e7;
    telem.altitude = parseFloat(telem.alt)/1000;
    telem.heading = parseFloat(telem.hdg)/100;
    return telem;
}

// Request the current location data of the plane and add it to the pos History list if unique
function fetchLocationData(port) {
    if (hubIp !== null && hubPort !== null) {
        fetch(`http://${hubIp}:${hubPort}/api/plane/telemetry?id=33&field=lat,lon,alt,hdg`)
            .then(response => response.json())
            .then(unparsedTelem => parseTelem(unparsedTelem))
            .then(telem => {
                addPosToHistory(telem);
                port.postMessage([CURR_POS_MSG, telem]);
                port.postMessage([POS_HISTORY_MSG, posHistory]);
            })
            .catch(err => {
                console.error(err);
                port.postMessage([CURR_POS_MSG, null]);
            });
    }
}


function handleMessage(port, type, data) {
    switch(type) {
        case HUB_CONN_MSG:
            // msg format:
            // 1 - hub ip
            // 2 - hub port
            hubIp = data[1];
            hubPort = data[2];
            // No post message required because this just tells the worker what ip and port to use
            break;
        case POS_HISTORY_MSG:
            // set pos history variable to the value they are saying
            posHistory = data[1];
            break;
    }
}

onconnect = function (e) {
    var port = e.ports[0];

    // Request location data every minute
    // Continue sending curr location data every second (inside this function)
    setInterval(() => {fetchLocationData(port)}, 1000);

    port.onmessage = function (e) {
        handleMessage(port, e.data[0], e.data);
    };
};