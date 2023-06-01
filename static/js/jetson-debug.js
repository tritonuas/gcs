import { alertDialog, checkRequest, closeWaitDialogs, connectToLocationWorker, formatHubURL, waitDialog} from "./util.js";

connectToLocationWorker();

function pullCameraConfig() {
    fetch(formatHubURL("/camera/config"))
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
    let exposureInput = document.getElementById('exposure-input');
    exposureInput.value = config["Exposure"]
    let exposureAutoInput = document.getElementById('exposure-auto-input');
    exposureAutoInput.value = config["ExposureAuto"]
}

function setupCameraConfigForm() {
    let form = document.getElementById('camera-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let gainInput = document.getElementById('gain-input');
        let gainAutoInput = document.getElementById('gain-auto-input');
        let exposureInput = document.getElementById('exposure-input');
        let exposureAutoInput = document.getElementById('exposure-auto-input');

        let config = {
            "Gain": gainInput.value,
            "GainAuto": gainAutoInput.value,
            "Exposure": exposureInput.value,
            "ExposureAuto": exposureAutoInput.value
        };

        fetch(formatHubURL("/camera/config"), {
            method: "POST",
            body: JSON.stringify(config)
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
            })
    });
}

document.addEventListener('DOMContentLoaded', () => {
    let gallery = document.getElementById('gallery');

    document.addEventListener('keydown', (e) => {
        if (e.key === "ArrowLeft") {
            gallery.swipe("left");
        } else if (e.key === "ArrowRight") {
            gallery.swipe("right");
        }
    });

    let form = document.getElementById('jetson-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let jetsonIp = document.getElementById('url-input').value;

        fetch(`http://${jetsonIp}/camera/capture`)
            .then(response => response.blob())
            .then(imageBlob => {
                const imageObjectURL = URL.createObjectURL(imageBlob);
                gallery.addImage(imageObjectURL);
                closeWaitDialogs();
            });

        waitDialog("Waiting for image...");
    });

    pullCameraConfig();
    setupCameraConfigForm();
});