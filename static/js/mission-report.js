import {getHubIp, getHubPort, alertDialog, connectToLocationWorker, confirmDialog} from './util.js'

import * as L from "../packages/leaflet-src.esm.js";

connectToLocationWorker();

var targetMarker = L.icon({
    iconUrl: '../images/red-X.png',
    iconSize: [32, 20],
    iconAnchor: [16, 10]
});




// Custom Tags for use in this page

// Shows what the plane currently has loaded in the specified slot
class BottleDescription extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});

        let link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', '../css/bottle.css');
        this.shadow.appendChild(link);

        this.alphanumericColor = document.createElement('p');

        this.alphanumeric = document.createElement('p');

        this.shapeColor = document.createElement('p');

        this.shape= document.createElement('p');

        this.container = document.createElement('fieldset');
        this.container.classList.add("container");

        this.legend = document.createElement('legend');

        this.container.appendChild(this.legend);
        this.container.appendChild(this.alphanumericColor);
        this.container.appendChild(this.alphanumeric);
        this.container.appendChild(this.shapeColor);
        this.container.appendChild(this.shape);

        this.shadow.appendChild(this.container);
    }

    isMannequin() {
        return this.alphanumeric.innerText == "MANNEQUIN";
    }

    setMannequin() {
        this.alphanumeric.innerText = "";
        this.alphanumeric.style="color: black";
        this.alphanumericColor.innerText = "MANNEQUIN";
        this.alphanumericColor.style="color: black";
        this.shape.innerText = "";
        this.shape.style= "color: black";
        this.shapeColor.innerText= "MANNEQUIN";
        this.shapeColor.style= "color:black";
    }

    setLabel(label) {
        this.legend.innerText = label;
        if (label == "") {
            this.legend.style = `display: none`;
        } else {
            this.legend.style = ``;
        }
    }

    setAlphanumeric(symbol, color) {
        this.alphanumeric.innerText= symbol;
        this.alphanumeric.style = `color: ${color}`;

        this.alphanumericColor.innerText = color;
        this.alphanumericColor.style = `color: ${color}`;
    }

    setShape(shape, color) {
        this.shape.innerText = shape;
        this.shape.style=`color: ${color}`;

        this.shapeColor.innerText = color;
        this.shapeColor.style=`color: ${color}`;
    }
}
customElements.define('bottle-description', BottleDescription);

// Shows a classified target, which may or may not have a match
class PotentialTarget extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});

        let link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', '../css/bottle.css');
        this.shadow.appendChild(link);

        let link2 = document.createElement('link');
        link2.setAttribute('rel', 'stylesheet');
        link2.setAttribute('href', '../packages/leaflet.css');
        this.shadow.appendChild(link2);

        this.img = document.createElement('img');
        this.img.width='5em';
        this.img.height='5em';

        this.bottleDescription = document.createElement('bottle-description');

        this.mapContainer = document.createElement('div');
        this.mapContainer.classList.add('map');

        this.location = document.createElement('p');

        this.container = document.createElement('fieldset');
        this.container.classList.add('container');
        this.legend = document.createElement('legend');

        this.container.appendChild(this.legend);
        this.container.appendChild(this.img);
        this.container.appendChild(this.mapContainer);
        this.container.appendChild(this.bottleDescription);
        this.container.appendChild(this.location);

        this.shadow.appendChild(this.container);
    }

    
    setTargetNum(num) {
        this.legend.innerText = `Potential Target ${num}`;
        this.mapContainer.id=`map-${num}`;
    }

    getTargetNum() {
        return this.legend.innerText;
    }

    setImgSrc(src) {
        this.img.src = src;
    }

    setBottleDescription(alphanumeric, alphanumericColor, shape, shapeColor, label="") {
        this.bottleDescription.setAlphanumeric(alphanumeric, alphanumericColor);
        this.bottleDescription.setShape(shape, shapeColor);
        this.bottleDescription.setLabel(label);
    }

    setMannequin() {
        this.bottleDescription.setMannequin();
    }

    setPosition(lat, lon) {
        this.location.innerHTML = `<b>(${lat},<br>${lon})</b>`;
        this.lat = lat;
        this.lon = lon;
    }

    initMap() {
        this.map = L.map(this.mapContainer).setView([this.lat, this.lon], 19);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 20,
            id: 'mapbox/satellite-v9',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: 'pk.eyJ1IjoidGxlbnR6IiwiYSI6ImNsM2dwNmwzczBrb24zaXcxcWNoNWZjMjQifQ.sgAV6vkF7vOLC4P1_WkV_w'
        }).addTo(this.map);

        let marker = L.marker([this.lat, this.lon], {icon: targetMarker});
        marker.addTo(this.map);

        setTimeout(()=>{this.map.invalidateSize(); this.map.setView([this.lat, this.lon])}, 100);
        this.mapContainer.addEventListener('click', () => {
            this.map.setView([this.lat, this.lon]);
        });
    }

    killMap() {
        this.map = null;
        this.mapContainer = document.createElement('div');
        this.mapContainer.classList.add('map');
    }

    resetMap() {
        this.map.invalidateSize();
        this.map.setView([this.lat, this.lon]);
    }

    connectedCallback() {
        this.initMap();
    }

    disconnectedCallback() {
        this.killMap();
    }
}

customElements.define('potential-target', PotentialTarget);

let bottleMap = {}; // Map of <bottle-description>'s for bottles A-E on the plane
let targetList = []; // List of <potential-target>'s for all the targets we've identified
let matches = {} // Map of Letter to Number mapping bottle to target

function addToBottleList(letter, alpha, alphaColor, shape, shapeColor) {
    let bottleDescription = new BottleDescription();
    bottleDescription.setAlphanumeric(alpha, alphaColor);
    bottleDescription.setShape(shape, shapeColor);
    bottleDescription.setLabel(letter);
    bottleMap[letter] = bottleDescription;
}

function addMannequinToBottleList(letter) {
    let bottleDescription = new BottleDescription();
    bottleDescription.setMannequin();
    bottleDescription.setLabel(letter);
    bottleMap[letter] = bottleDescription;
}

function createPotentialTarget(imgSrc, lat, lon, alpha, alphaColor, shape, shapeColor) {
    let potentialTarget = new PotentialTarget();
    potentialTarget.setBottleDescription(alpha, alphaColor, shape, shapeColor);
    potentialTarget.setImgSrc(imgSrc);
    potentialTarget.setTargetNum(targetList.length);
    potentialTarget.setPosition(lat, lon);
    return potentialTarget;
}

function addToTargetList(imgSrc, lat, lon, alpha, alphaColor, shape, shapeColor) {
    // the reason we are creating two versions at the same time is because the potential target could be
    // displayed at different parts of the DOM at the same time (e.g. the match list and the target gallery)
    //
    // the reason we don't use cloneNode(true) is because this only copies over the HTML parts of the objects,
    // not all of the internal "this" variables that the custom tags rely on

    // this line needs to happen first because adding to targetList changes the offset createPotentialTarget uses
    document.getElementById('target-gallery').addElem(createPotentialTarget(imgSrc, lat, lon, alpha, alphaColor, shape, shapeColor));
    targetList.push(createPotentialTarget(imgSrc, lat, lon, alpha, alphaColor, shape, shapeColor));
}

function addMannequinToTargetList(imgSrc, lat, lon) {
    // create the two targets
    let target1 = createPotentialTarget(imgSrc, lat, lon, "", "", "", "");
    target1.setMannequin();
    let target2 = createPotentialTarget(imgSrc, lat, lon, "", "", "", "");
    target2.setMannequin();

    // Add to respective positions in page 
    // we don't have an ordering problem here because targets already created
    targetList.push(target1);
    document.getElementById('target-gallery').addElem(target2);
}

function setMatch(bottleLetter, targetNumber) {
    matches[bottleLetter] = targetNumber;
}

function renderMatches() {
    let matchList = document.getElementById('match-list');
    matchList.innerHTML = '';
    for (const bottleLetter in matches) {
        let matchContainer = document.createElement("div");
        matchContainer.classList.add('match-container');
        matchContainer.appendChild(bottleMap[bottleLetter]);
        matchContainer.appendChild(targetList[matches[bottleLetter]]);
        matchList.appendChild(matchContainer)
    }
}

function getManualOperatorInputId(letter) {
    return `bottle${letter}-assignment`;
}

function updateManualOperator() {
    for (const letter of ["A", "B", "C", "D", "E"]) {
        let id = getManualOperatorInputId(letter);
        let input = document.getElementById(id);
        input.value = matches[letter];
    }
}

function setupManualOperator() {
    let reassignForm = document.getElementById('reassign-form');
    reassignForm.addEventListener('keydown', (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
        }
    });

    reassignForm.addEventListener('submit', (e) => {
        e.preventDefault();

        confirmDialog("Submit updated bottle assignments?").addEventListener('close', (e) => {
            e.preventDefault();
            if (e.target.returnValue == "true") {
                console.log("true");
            } else {
                console.log('false');
            }
        });
    });

    let manualOperatorOutput = document.getElementById('manual-operator-output');


    let bottles = ["A", "B", "C", "D", "E"];
    bottles.forEach((letter) => {
        let fieldset = document.createElement('fieldset');
        fieldset.classList.add('bottle-reassignment-fieldset');

        const id = getManualOperatorInputId(letter);

        let label = document.createElement('label');
        label.for = id;
        label.innerText = `${letter}:`;
        let input = document.createElement('input');
        input.name = id;
        input.id = id;
        input.type="text"
        input.value = matches[letter];

        input.addEventListener('change', (e) => {
            let intVal = parseInt(e.target.value);
            if (isNaN(intVal) || intVal < 0 || intVal >= targetList.length) {
                alertDialog(`Error: Target must be a valid integer value from 0 to ${targetList.length-1}`, true);
                e.target.value = matches[letter];
                return;
            }
            for (const letterToCheck in matches) {
                if (intVal == matches[letterToCheck]) {
                    alertDialog(`Error: Target ${intVal} already assigned to Bottle ${letterToCheck}`, true);
                    e.target.value = matches[letter];
                    return;
                }
            }

            e.target.value = intVal;

            matches[letter] = intVal;
            renderMatches();
        });

        fieldset.appendChild(label);
        fieldset.appendChild(input);
        manualOperatorOutput.append(fieldset);
    });

    let swapBtn = document.createElement('input');
    swapBtn.type = "button";
    swapBtn.value = "Swap Two Assignments";
    manualOperatorOutput.append(swapBtn);
    swapBtn.addEventListener('click', () => {
        let dialog = swapDialog();
        dialog.addEventListener('close', (e) => {
            e.preventDefault();
            if (e.target.returnValue == "Swap") {
                let bottle1 = document.getElementById('swap-bottle1').value;
                let bottle2 = document.getElementById('swap-bottle2').value;
                if (isValidBottle(bottle1) && isValidBottle(bottle2) && bottle1 != bottle2) {
                    let oldBottle1 = matches[bottle1];
                    matches[bottle1] = matches[bottle2];
                    matches[bottle2] = oldBottle1;
                    renderMatches();
                    updateManualOperator();
                } else {
                    alertDialog("Error: invalid bottles", true);
                }
            }
            document.body.removeChild(dialog);
        });
    });

    let confirmBtn = document.createElement('input');
    confirmBtn.type = "submit";
    confirmBtn.value = "Confirm Assignments";
    manualOperatorOutput.append(confirmBtn);
}

function isValidBottle(letter) {
    return letter == "A" || letter == "B" || letter == "C" || letter == "D" || letter == "E";
}

function swapDialog() {
    let dialog = document.createElement('dialog');
    dialog.innerHTML = `<p>Choose Two Bottles to Swap</p>
                        <form method="dialog">
                        <input id="swap-bottle1" type="text" placeholder="bottle1">
                        <input id="swap-bottle2" type="text" placeholder="bottle2">
                        <input type="submit" id="swap" value="Swap">
                        <input type="submit" id="cancel" value="Cancel">
                        </form>`;
    document.body.appendChild(dialog);
    dialog.showModal();
    return dialog;
}

function setUpTargetGallery() {
    let targetGallery = document.getElementById('target-gallery');
    document.addEventListener('keydown', (e) => {
        if (e.key === "ArrowLeft") {
            targetGallery.swipeLeft();
            targetGallery.getCurrElem().resetMap();
        } else if (e.key === "ArrowRight") {
            targetGallery.swipeRight();
            targetGallery.getCurrElem().resetMap();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    addToBottleList("A", "5", "red", "square", "blue");
    addToBottleList("B", "W", "blue", "circle", "magenta");
    addToBottleList("C", "Z", "green", "square", "red");
    addToBottleList("D", "9", "magenta", "square", "green");
    addMannequinToBottleList("E");

    addToTargetList("../images/bread.png", 32, 78, "5", "red", "square", "blue");
    setMatch("A", 0);
    addToTargetList("../images/duck.gif", 32, 66, "W", "blue", "circle", "magenta");
    setMatch("B", 1);
    addToTargetList("../images/gray-duck.gif", 32, 50, "Z", "green", "cross", "magenta");
    addToTargetList("../images/gray-duck.gif", 32, 50, "x", "black", "star", "cyan");
    addToTargetList("../images/gray-duck.gif", 32, 50, "y", "gray", "square", "blue");
    addToTargetList("../images/gray-duck.gif", 32, 50, "w", "green", "heptagon", "red");

    addToTargetList("../images/cloud-bg.jpg", 32, 50, "Z", "green", "square", "red");
    setMatch("C", 6);
    addToTargetList("../images/cloud-bg2.jpg", 32, 50, "9", "magenta", "square", "green");
    setMatch("D", 7);
    addMannequinToTargetList('../images/tuas-logo.png', 30, 40);
    setMatch("E", 8);

    renderMatches();

    setupManualOperator();
    setUpTargetGallery();
});
