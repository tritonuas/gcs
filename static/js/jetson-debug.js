import { closeWaitDialogs, connectToLocationWorker, waitDialog} from "./util.js";

connectToLocationWorker();

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

        fetch(`http://${jetsonIp}/lucid/capture`)
            .then(response => response.blob())
            .then(imageBlob => {
                const imageObjectURL = URL.createObjectURL(imageBlob);
                gallery.addImage(imageObjectURL);
                closeWaitDialogs();
            });

        waitDialog("Waiting for image...");
    });
});