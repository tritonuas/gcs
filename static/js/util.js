export function feetToMeters(feet) {
    return feet / 3.281;
}

export function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

export function saveHubInfo(ip, port) {
    localStorage.setItem('hub-ip', ip);
    localStorage.setItem('hub-port', port);
}

export function getHubIp() {
    let ip = localStorage.getItem('hub-ip');
    if (ip == null) {
        ip = "localhost"; 
    }
    return ip;
}

export function getHubPort() {
    let port = localStorage.getItem('hub-port');
    if (port == null) {
        port = "5000";
    }
    return port;
}

export function savePosHistory(posHistory) {
    sessionStorage.setItem('pos-history', JSON.stringify(posHistory));
}

export function getPosHistory() {
    let posHistory = sessionStorage.getItem('pos-history');
    if (posHistory !== null) {
        return JSON.parse(posHistory);
    }
    return posHistory;
}

export function saveCurrPos(currPos) {
    sessionStorage.setItem('curr-pos', JSON.stringify(currPos));
}

export function clearPosHistory(locationWorker) {
    sessionStorage.setItem('pos-history', '[]');
    locationWorker.port.postMessage([POS_HISTORY_MSG, []]); // tell location worker to wipe it's pos history too
}

export function getCurrPos() {
    let currPos = sessionStorage.getItem('curr-pos');
    if (currPos !== null) {
        return JSON.parse(currPos);
    }
    return currPos;
}

export function alertDialog(s, error=false) {
    let alertDialog = document.createElement('dialog');
    if (error) {
        alertDialog.classList.add('error');
    }

    alertDialog.innerHTML = `<p>${s}</p>
                             <form method="dialog">
                             <button>Ok</button>
                             </form>`;
    document.body.appendChild(alertDialog);
    alertDialog.showModal();
    alertDialog.addEventListener('cancel', (e) => {
        e.preventDefault()
    });
    alertDialog.addEventListener('close', () => {
        document.body.removeChild(alertDialog);
    });
    return alertDialog;
}

export function alertDialogCursed() {
    let alertDialog = document.createElement('dialog');
    alertDialog.classList.add('cursed');

    alertDialog.innerHTML = `
                             <form method="dialog" style="display:flex; flex-direction: column">
                             <img src="../images/skull.webp" width="512" height="512">
                             <button>Ok</button>
                             </form>`;
    document.body.appendChild(alertDialog);
    alertDialog.showModal();
    alertDialog.addEventListener('cancel', (e) => {
        e.preventDefault()
    });
    alertDialog.addEventListener('close', () => {
        document.body.removeChild(alertDialog);
    });
    return alertDialog;
}

export function confirmDialog(s) {
    let confirmDialog = document.createElement('dialog');
    confirmDialog.innerHTML = `<p>${s}</p>
                               <form method="dialog">
                               <button type="submit" id="cancel-button" value="false">Cancel</button>
                               <button type="submit" id="accept-button" value="true">Ok</button>
                               </form>`;

    document.body.appendChild(confirmDialog);
    confirmDialog.showModal();
    confirmDialog.addEventListener('close', () => {
        document.body.removeChild(confirmDialog);
    });
    return confirmDialog;
}

export function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

export function waitDialog(s) {
    let waitDialog = document.createElement('dialog');
    waitDialog.classList.add('waitDialog');

    let gifNum = getRandomInt(1, 4);

    waitDialog.innerHTML = `<p>${s}</p>
                            <form method="dialog" class="wait-dialog">
                            <img src="../images/waiting${gifNum}.gif" class="wait-icon" width="128" height="128">
                            </form>`;

    document.body.appendChild(waitDialog);
    waitDialog.showModal();
    waitDialog.addEventListener('close', () => {
        document.body.removeChild(waitDialog);
    });
    return waitDialog;
}

// plural cause potentially there could be multiple on top of each other
export function closeWaitDialogs() {
    let dialogs = document.getElementsByClassName('wait-dialog');
    for (const dialog of dialogs) {
        dialog.submit();
    }
}

export function roundDecimal(val, places) {
    return (Number)(val).toFixed(places);
} 

export function getCompetitionLatLon() {
    return [38.31618822932463, -76.5484689508827]
}

export function getDefaultCompetitionBounds() {
    return [
        [
            38.31722979755967,
            -76.55701863422458
        ],
        [
            38.3160801028265,
            -76.55731984244503
        ],
        [
            38.31600059675041,
            -76.55689020189466
        ],
        [
            38.31546739500083,
            -76.55376201277696
        ],
        [
            38.31470980862425, 
            -76.54936361414539
        ],
        [
            38.31424154692598,
            -76.54662761646904
        ],
        [
            38.31369801280048,
            -76.54342380058223
        ],
        [
            38.3131406794544,
            -76.54011767488228
        ],
        [
            38.31508631356025,
            -76.53962865078672
        ],
        [
            38.31615083692682,
            -76.54497738793511
        ],
        [
            38.31734210679102,
            -76.54460850466796
        ],
        [
            38.31859044679581,
            -76.55193291583835
        ],
        [
            38.3164700703248,
            -76.55255360208943
        ],
        [
            38.31722979755967,
            -76.55701863422458
        ],
        [
            38.31722979755967,
            -76.55701863422458
        ],
    ];
}

// Constants for location-worker.js

export const HUB_CONN_MSG = 'HUB_CONN';
export const POS_HISTORY_MSG = 'POS_HISTORY';
export const CURR_POS_MSG = 'CURR_POS';

// Code to set up connection to location worker

/*
    This basically works how we want it to with some caveats:

    1. If you have multiple tabs open, they are both going to receive telemetry updates and then both add the current telem position
       to the pos-history storage list. Current solution is just don't have multiple tabs open in the site, but that is kind of weird
       so we should probably solve this.
    2. Session storage is currently unbounded in how much it can grow. TODO: make session storage only save X records, where X is flight
       data for the last 20ish minutes.
    3. IN THE FUTURE that actual solution for this is that the backend should just have an endpoint for pos history in the last X minutes
       so each page can just get it when it needs it
    
*/

// returns the locationWorker (if we need it for some reason, this is currently not used)
export function connectToLocationWorker() {
    // Shared Worker code
    if (!!window.SharedWorker) { // make sure browser supports SharedWorker API
        let locationWorker = new SharedWorker("../js/location-worker.js", {type: "module"});
        locationWorker.port.start();
        locationWorker.port.postMessage([HUB_CONN_MSG, getHubIp(), getHubPort()]);
        let posHistory = getPosHistory();
        if (posHistory !== null) {
            locationWorker.port.postMessage([POS_HISTORY_MSG, getPosHistory()]);
        }

        locationWorker.port.onmessage = function(e) {
            handleLocationMessage(e.data[0], e.data);
        };

        return locationWorker;
    }

    return null;
}

function handleLocationMessage(type, data) {
    switch (type) {
        case POS_HISTORY_MSG:
            savePosHistory(data[1]);
            break;
        case CURR_POS_MSG:
            saveCurrPos(data[1]);
            break;
    }
}


export function important() {
    if (Math.random() < 0.01) {
        let body = document.getElementsByTagName('body')[0];
        speak("Suspicious");
    }
}

export function formatHubURL(endpoint) {
    return `http://${getHubIp()}:${getHubPort()}${endpoint}`;
}

export function pasteDialog(msg, s) {
    let pasteDialog = document.createElement('dialog');
    pasteDialog.innerHTML = `<p>${msg}</p> 
                               <form method="dialog">
                               <textarea> ${s} </textarea>
                               <button type="submit" id="accept-button" value="true">Ok</button>
                               </form>`;

    document.body.appendChild(pasteDialog);
    pasteDialog.showModal();
    pasteDialog.addEventListener('close', () => {
        document.body.removeChild(pasteDialog);
    });
    return pasteDialog;
}

export function checkRequest(r){
    if (!r.ok) {
        throw `Request not okay ${r.statusText}`;
    }
    return r;
}

export function formDataToJSON(formData) {
    let formDataObj = {};
    formData.forEach((value, key) => (formDataObj[key] = value));
    return formDataObj;
}

export function speak(message) {
    let msg = new SpeechSynthesisUtterance();
    msg.text = message;
    window.speechSynthesis.speak(msg);
}