import { connectToLocationWorker, formatHubURL, getCompetitionLatLon, alertDialog} from "./util.js";

connectToLocationWorker();


// Everything for the Bottle Form
function setupBottleForm() {
    let bottleForm= document.getElementById('bottle-form');
    let colorTemplate = document.getElementById('color-template');
    let shapeTemplate = document.getElementById('shape-template');

    let alphanumerics = document.querySelectorAll('.alphanumeric');
    alphanumerics.forEach((inputTag) => {
        let bottleLetter= inputTag.dataset.letter;
        let alphaColorInput = colorTemplate.content.firstElementChild.cloneNode(true);
        alphaColorInput.name = `bottle${bottleLetter}-alphanumeric-color`;
        let shapeInput = shapeTemplate.content.firstElementChild.cloneNode(true);
        shapeInput.name = `bottle${bottleLetter}-shape`;
        let shapeColorInput = colorTemplate.content.firstElementChild.cloneNode(true);
        shapeColorInput.name = `bottle${bottleLetter}-shape-color`;

        inputTag.after(alphaColorInput);
        alphaColorInput.after(shapeInput);
        shapeInput.after(shapeColorInput);
    });

    let oldMannequinLetter = null;
    let mannequinSelect = document.getElementById("mannequin-select");
    mannequinSelect.addEventListener("change", (e) => {
        if (oldMannequinLetter != null) {
            document.getElementById(`bottle${oldMannequinLetter}-fieldset`).removeAttribute('disabled');
        }
        document.getElementById(`bottle${e.target.value}-fieldset`).setAttribute('disabled', 'true');
        oldMannequinLetter = e.target.value;
    });

    bottleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let formData = new FormData(bottleForm);
        let json = {};
        formData.forEach((value, key) => json[key] = value);
        console.log(json);
    });
}

function getMapMode() {
    return document.querySelector('input[name="map-mode"]:checked').value;
}

// Two roles:
// Make the proper radio selection highlighted when you hover over the clear button
// Make the map clear all polys when you click on the clear button
function setupMapClearBtn() {
    let clearBtn = document.getElementById("map-clear-btn");
    clearBtn.addEventListener("mouseenter", () => {
        let label = document.getElementById(`${getMapMode()}-label`);
        label.style.color = 'lightgray';
        label.style.textDecoration = "line-through";
    });
    clearBtn.addEventListener("mouseleave", () => {
        let label = document.getElementById(`${getMapMode()}-label`);
        label.style.color = '';
        label.style.textDecoration = "";
    });
    clearBtn.addEventListener('click', () => {
        let tmap = document.getElementById('input-map'); 
        tmap.clearPoly(getMapMode());
    });
}

// Two Roles:
// make the proper extendo form highlight when hovering over
// when clicked pull the corresponding radio selection into the corresponding extendo form
function setupMapPullBtn() {
    let pullBtn = document.getElementById("map-pull-btn");
    pullBtn.addEventListener("mouseenter", () => {
        let eForm = document.getElementById(`extendo-${getMapMode()}`);
        eForm.highlight(true);
    });
    pullBtn.addEventListener("mouseleave", () => {
        let eForm = document.getElementById(`extendo-${getMapMode()}`);
        eForm.highlight(false);
    });
    pullBtn.addEventListener('click', () => {
        let tmap = document.getElementById('input-map');
        let eForm = document.getElementById(`extendo-${getMapMode()}`);
        let latlngs = tmap.getPolyLatLngs(getMapMode());
        eForm.insertLatLngData(latlngs, getMapMode());
    });
}

function mapLocationDialog() {
    let confirmDialog = document.createElement('dialog');
    confirmDialog.style = `display: flex; flex-direction: column; align-items: center; justify-content: center;`
    confirmDialog.innerHTML = `<p>Set Location</p>
                               <form method="dialog"> 
                                <button type="button" id="competition-btn" value="Competition">Load Competition</button>
                                <button type="button" id="black-mountain-btn" value="BlackMountain">Load Black Mountain</button>
                                <input type="text" id="lat-loc-input" placeholder="Latitude">
                                <input type="text" id="lon-loc-input" placeholder="Longitude">
                                <button type="submit" id="loc-submit-btn" value="Set">Ok</button>
                               </form>`;
    document.body.appendChild(confirmDialog);

    let map = document.getElementById('input-map');
    map.highlight(true);

    let latInput = document.getElementById('lat-loc-input');
    let lonInput = document.getElementById('lon-loc-input');
    let blackMountainBtn = document.getElementById('black-mountain-btn');
    blackMountainBtn.addEventListener('click', (e) => {
        e.preventDefault();
        latInput.value = '32.990816606733354';
        lonInput.value = '-117.12856674747697';
    });
    let competitionBtn = document.getElementById('competition-btn');
    competitionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        latInput.value = '38.31542593549111';
        lonInput.value = '-76.55062632801757';
    });

    confirmDialog.showModal();
    confirmDialog.addEventListener('close', () => {
        map.centerMap([latInput.value, lonInput.value])
        map.changeZoom(map.dataset.maxZoom, false);
        map.highlight(false, false);

        document.body.removeChild(confirmDialog);
    });
    return confirmDialog;
}

function setupMapMoveBtn() {
    let moveBtn = document.getElementById("map-move-btn");
    moveBtn.addEventListener("mouseenter", () => {
        let map = document.getElementById('input-map');
        map.highlight(true);
    });
    moveBtn.addEventListener("mouseleave", () => {
        let map = document.getElementById('input-map');
        map.highlight(false);
    });
    moveBtn.addEventListener('click', () => {
        mapLocationDialog();
    });
}

function setupMapInput() {
    let tmap = document.getElementById("input-map");
    // These IDS in the polymap should align with the values of the radio buttons in the html
    tmap.initPoly("boundaries", "red", false);
    tmap.initPoly("waypoints", "blue", true);
    tmap.initPoly("search", "magenta", false);
    tmap.addOnClick((e) => {
        tmap.addPointToPoly(getMapMode(), e.latlng);
    });
    window.addEventListener('load', () => {
        tmap.centerMap(getCompetitionLatLon());
    });

    let waypointsEForm = document.getElementById(`extendo-waypoints`);
    let boundariesEForm = document.getElementById(`extendo-boundaries`);
    let searchEForm = document.getElementById(`extendo-search`);

    let wptsRadio = document.getElementById('waypoints-input');
    wptsRadio.addEventListener('click', () => {
        waypointsEForm.style.display = '';
        boundariesEForm.style.display = 'none';
        searchEForm.style.display = 'none';
    });
    let boundsRadio = document.getElementById('boundaries-input');
    boundsRadio.addEventListener('click', () => {
        waypointsEForm.style.display = 'none';
        boundariesEForm.style.display = '';
        searchEForm.style.display = 'none';
    });
    let searchRadio = document.getElementById('search-input');
    searchRadio.addEventListener('click', () => {
        waypointsEForm.style.display = 'none';
        boundariesEForm.style.display = 'none';
        searchEForm.style.display = '';
    });

    setupMapClearBtn();
    setupMapPullBtn();
    setupMapMoveBtn();

    let parseFormData = (data, keys) => {
        let result = [];
        let resultSize = Object.keys(data).length / keys.length;

        for (let i = 0; i < resultSize; i++) {
            let curr = {};
            for (const key of keys) {
                curr[key] = parseFloat(data[`${i}-${key}`]);
            }
            result.push(curr);
        }
        return result;
    }

    waypointsEForm.setOnSubmit((data) => {
        data = parseFormData(data, ["latitude", "longitude", "altitude"]);
        let err = false;
        fetch(formatHubURL("/api/mission/waypoints"), {
            method: "POST", 
            body: JSON.stringify(data), 
            headers:{'content-type': 'application/json'}
        })
            .then(r => {
                if (!r.ok) {
                    err = true;
                }
                return r;
            })
            .then(r => r.text())
            .then(text => {
                alertDialog(text, err);
            })
            .catch(err => {
                alertDialog(err, true);
            });
    });
    boundariesEForm.setOnSubmit((data) => {
        data = parseFormData(data, ["latitude", "longitude"]);
        console.log(data);
    });
    searchEForm.setOnSubmit((data) => {
        data = parseFormData(data, ["latitude", "longitude"]);
        console.log(data);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    setupBottleForm();
    setupMapInput();
});