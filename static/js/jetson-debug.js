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
});