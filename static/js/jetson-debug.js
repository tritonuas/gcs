import { alertDialog, checkRequest, closeWaitDialogs, connectToLocationWorker, formatHubURL, waitDialog} from "./util.js";

connectToLocationWorker();

function pullCameraConfig() {
    fetch(formatHubURL("/api/mission/camera/config"))
        .then(r => {
            checkRequest(r);
            return r;
        })
        .then(response => response.json())
        .then(config => {
            setCameraConfig(config);
        })
        .catch(err => {
            alertDialog(err, true);
        })
}

// Set values based on the config
function setCameraConfig(config) {
    let gainInput = document.getElementById('gain-input');
    gainInput.value = config["Gain"]
    let gainAutoInput = document.getElementById('gain-auto-input');
    gainAutoInput.value = config["GainAuto"]
    let exposureInput = document.getElementById('exposure-time-input');
    exposureInput.value = config["ExposureTime"]
    let exposureAutoInput = document.getElementById('exposure-auto-input');
    exposureAutoInput.value = config["ExposureAuto"]
}

function setupCameraConfigForm() {
    let form = document.getElementById('camera-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let gainInput = document.getElementById('gain-input');
        let gainAutoInput = document.getElementById('gain-auto-input');
        let exposureTimeInput = document.getElementById('exposure-time-input');
        let exposureAutoInput = document.getElementById('exposure-auto-input');

        let config = {
            "Gain": parseFloat(gainInput.value),
            "GainAuto": gainAutoInput.value,
            "ExposureTime": parseFloat(exposureTimeInput.value),
            "ExposureAuto": exposureAutoInput.value
        };

        fetch(formatHubURL("/api/mission/camera/config"), {
            method: "POST",
            body: JSON.stringify(config)
        })
            .then(response => response.text())
            .then(text => {
                alertDialog(text);
            })
            .catch(err => {
                alertDialog(err, true);
            })
    });
}

function setCameraStatus(json) {
    let status = document.getElementById('camera-status-desc');
    status.innerText = String(json["connected"]);
    let streaming = document.getElementById('camera-streaming-desc');
    streaming.innerText = String(json["streaming"]);
}

function pullCameraStatus() {
    fetch(formatHubURL("/api/mission/camera/status"))
        .then(r => {
            checkRequest(r);
            return r;
        })
        .then(response => response.json())
        .then(status => {
            setCameraStatus(status);
        })
        .catch(err => {
            console.error(err);
            setCameraStatus({"connected": "ERROR", "streaming": "ERROR"});
        })
}

function setupCameraControlForm() {
    let form = document.getElementById("camera-control-form");
    form.addEventListener('submit', (e) => {
        e.preventDefault();
    });

    let gallery = document.getElementById('gallery');

    let takePicBtn = document.getElementById('take-pic-btn');
    takePicBtn.addEventListener('click', () => {
        fetch(formatHubURL("/api/mission/camera/capture"))
            .then(r => {
                checkRequest(r);
                return r;
            })
            .then(response => response.blob())
            .then(imageBlob => {
                const imageObjectURL = URL.createObjectURL(imageBlob);
                gallery.addImage(imageObjectURL);
                closeWaitDialogs();
            })
            .catch(err => {
                alertDialog(err, true);
            });
        waitDialog("Waiting for image...");
    });

    let startStreamBtn = document.getElementById('start-stream-btn');
    startStreamBtn.addEventListener('click', () => {
        fetch(formatHubURL("/api/mission/camera/start"), {
            method: "POST"
        })
            .then(r => {
                checkRequest(r);
                return r;
            })
            .then(response => response.text())
            .then(text => {
                alertDialog(text);
            })
            .catch(err => {
                alertDialog(err, true);
            });
    });

    let stopStreamBtn = document.getElementById('stop-stream-btn');
    stopStreamBtn.addEventListener('click', () => {
        fetch(formatHubURL("/api/mission/camera/stop"), {
            method: "POST"
        })
            .then(r => {
                checkRequest(r);
                return r;
            })
            .then(response => response.text())
            .then(text => {
                alertDialog(text);
            })
            .catch(err => {
                alertDialog(err, true);
            });
    });
}

let mostRecentTimestamp = 0;

function pullMostRecentRawImage() {
    let gallery = document.getElementById('gallery');
    fetch(formatHubURL(`/api/mission/image/raw?timestamp=${mostRecentTimestamp}`))
        .then(r => {
            checkRequest(r);
            let timestamp = r.headers.get('Timestamp');
            if (timestamp != null) {
                mostRecentTimestamp = timestamp;
            }
            return r;
        })
        .then(response => response.blob())
        .then(imageBlob => {
            const imageObjectURL = URL.createObjectURL(imageBlob);
            gallery.addImage(imageObjectURL);
        })
        .catch(err => {
            console.error(err);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    setupCameraControlForm();
    pullCameraConfig();
    setupCameraConfigForm();
    setInterval(pullCameraStatus, 1000);
    setInterval(pullMostRecentRawImage, 1000);
});