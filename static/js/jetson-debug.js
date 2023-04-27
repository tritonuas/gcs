import { alertDialog, closeWaitDialogs, connectToLocationWorker, formatHubURL, waitDialog} from "./util.js";

connectToLocationWorker();

function appendLabelAndInput(fieldset, name, desc, inputType) {
    let label = document.createElement("label");
    label.setAttribute('for', name);
    label.addEventListener('click', () => {alertDialog(desc)});
    label.innerText = name;
    let input = document.createElement("input");
    input.setAttribute("type", inputType);
    input.setAttribute("name", name);
    input.dataset['desc'] = desc;
    
    fieldset.appendChild(label);
    fieldset.appendChild(input);
}

function setupAnalogParams() {
    let fieldset = document.getElementById('analog-fieldset');
    let info = [
        [
            "GainSelector",
            "Selects which Gain is controlled by the variosu Gain features",
            "text"
        ],
        [
            "Gain",
            "Controls the selected Gain as an absolute physical value",
            "text"
        ],
        [
            "GainAuto",
            "Sets the automatic gain control mode",
            "text"
        ],
        [
            "BlackLevelSelector",
            "Controls the BlackLevel as an absolute physical value",
            "text"
        ],
        [
            "BlackLevelRaw",
            "Controls the raw BlackLevel value",
            "text"
        ],
        [
            "BalanceRatioSelector",
            "Selects which BalanceRatio is controlled by the various Balance Ratio features.",
            "text"
        ],
        [
            "BalanceRatio",
            "Controls the selected BalanceRatio as an absolute physical value. This is an amplification factor applied to the video signal.",
            "text"
        ],
        [
            "BalanceWhiteAuto",
            "Controls the mode for automatic white balancing between the color channels. The white balancing ratios are automatically adjusted.",
            "text"
        ],
        [
            "BalanceWhiteEnable",
            "Activates balance white features",
            "text"
        ],
        [
            "BalanceWhiteAutoAnchorSelector",
            "Controls whych type of statistics are used for BalanceWhiteAuto",
            "text"
        ],
        [
            "AwbWhitePatchEnable",
            "Controls if the white patch algorithm is used for BalanceWhiteAuto",
            "text"
        ],
        [
            "AwbStatsFrameCount",
            "Controls how many frames are used for collecting statistics for BalanceWhiteAuto.",
            "text"
        ],
        [
            "GammaEnable",
            "Controls the selected balance ratio as an absolute physical value. This is an amplification factor applied to the video signal.",
            "text"
        ],
        [
            "GammaEnable",
            "Controls the selected balance ratio as an absolute physical value. This is an amplification factor applied to the video signal.",
            "text"
        ],
        [
            "Gamma",
            "Controls the gamma correction of pixel intensity",
            "text"
        ]
    ]

    for (const node of info) {
        appendLabelAndInput(fieldset, node[0], node[1], node[2])
    }
}

function setupActivationParams() {
    let fieldset = document.getElementById('activation-fieldset');

    let info = [
        [
            "ExposureTime",
            "Controls the device exposure tmie in microseconds (us).",
            "number"
        ],
        [
            "ExposureAuto",
            "Sets the automatic exposure mode.",
            "text"
        ]
    ]

    for (const node of info) {
        appendLabelAndInput(fieldset, node[0], node[1], node[2])
    }
}

function fillParamsForm(json) {

}

function setupParamsForm() {
    setupAnalogParams();
    setupActivationParams();

    document.getElementById('pull-params-btn')
        .addEventListener('click', () => {
            let jetsonIp = document.getElementById('url-input').value;
            fetch(`http://${jetsonIp}/camera/config`)
                .then(r => r.json())
                .then(json => {
                    fillParamsForm(json);
                })
                .catch(err => {
                    alertDialog(err, true);
                });
        });

    document.getElementById('camera-form')
        .addEventListener('submit', (e) => {
            e.preventDefault();
            let jetsonIp = document.getElementById('url-input').value;
            let formData = new FormData(e.target);
            let json = {};
            formData.forEach((value, key) => json[key] = value);
            fetch(`http://${jetsonIp}/camera/config`, {
                method: "POST",
                headers: {"content-type": "application/json"},
                body: JSON.stringify(json)
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

    setupParamsForm();
});