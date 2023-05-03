import {saveHubInfo, alertDialog, getHubIp, getHubPort, formatHubURL, roundDecimal, connectToLocationWorker, confirmDialog, formDataToJSON, checkRequest } from "./util.js"

connectToLocationWorker();

function setConnectionStatus(json, output_id, expect_bool=true) {
    let output = document.getElementById(output_id);
    output.innerHTML = '';

    let formatConnItem = (type, connected) => {
        if (expect_bool) {
            if (connected) {
                return `<li style="color:green; font-size: 2em;"> ${type} <img src="../images/yes.gif" width=64 height=64> </img> <li>`
            } else {
                return `<li style="color:red; font-size: 2em;"> ${type} <img src="../images/noooo.gif" width=64 height=64> </img> <li>`
            }
        } else {
            output.dataset['pulse'] = 'true';
            setTimeout(() => {
                output.dataset['pulse'] = 'false';
            }, 500)
            // expect_bool = false, so directly output the message instead of putting silly zoomer pictures
            return `<li style="color:black; font-size: 2em; solid black"> <p style="border-bottom: 2px solid black">${type} </p> <p> ${connected} </p> <li>`
        }
    };

    output.innerHTML = "";
    let ul = document.createElement("ul");
    for (const prop in json) {
        ul.insertAdjacentHTML("afterbegin", formatConnItem(prop, json[prop]));
    }
    output.insertAdjacentElement("beforeend", ul);
}

function pullMavlinkInfo() {
    fetch(formatHubURL('/api/mavlink/endpoints'))
        .then(r => r.json())
        .then(json => {
            let input = document.getElementById('plane-ip-input');
            input.value = json["plane"];
            
            let keys = ["ip"];
            let vals = [];
            for (const ip of json["router"]) {
                vals.push(ip);
            }

            let eForm = document.getElementById('mavlink-eform');
            eForm.insertGenericData(keys, vals);
        })
        .catch(err => {
            console.error(`Failed to pull Mavlink endpoints info: ${err}`);
        });
}

function setupMavlinkEndpointSubmits() {
    let planeForm = document.getElementById('mavlink-plane-form');
    let eForm = document.getElementById('mavlink-eform');

    let putEndpoints = (json) => {
        fetch(formatHubURL('/api/mavlink/endpoints'), {
            method: 'PUT',
            body: JSON.stringify(json)
        })
            .then(r => {
                switch (r.status) {
                    case 200:
                        alertDialog("Successfully uploaded Plane routing IP.");
                        break;
                    default:
                        alertDialog(`Error: ${r.status}`, true);
                        break;
                }
            })
            .catch(err => {
                alertDialog(`Error: ${err}`, true);
            });
    }

    eForm.setOnSubmit((data) => {
        let planeIp = document.getElementById('plane-ip-input').value;

        let router = [];
        for (const ip of Object.values(data)) {
            router.push(ip);
        }

        let body = {"plane": planeIp, "router": router};

        putEndpoints(body);
    });
}

function setupJetsonMavForm() {
    let form = document.getElementById('jetson-mav-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        confirmDialog("I Solemly swear that the plane is not currently linked over mavlink. If it is, THEN THIS WILL BRICK THE PLANE!!!")
            .addEventListener("close", (e_dialog) => {
                e_dialog.preventDefault();
                if (e_dialog.target.returnValue == "true") {
                    let json = formDataToJSON(new FormData(e.target));
                    fetch(formatHubURL("/api/plane/mavlink/connect"), {
                        method: "POST",
                        body: JSON.stringify(json),
                        headers: {'content-type': 'application/json'}
                    })
                        .then(response => response.text())
                        .then(text => {
                            alertDialog(text);
                        })
                        .catch(err => {
                            alertDialog(err, true)
                        });
                }
            });

    });
}

document.addEventListener('DOMContentLoaded', () => {

    // Handling Form Submission
    let form = document.getElementById('hub-info-form');

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        let hubIp = document.getElementById('hub-ip').value;
        let hubPort = document.getElementById('hub-port').value;

        saveHubInfo(hubIp, hubPort);

        alertDialog(`Hub ip:port set to ${hubIp}:${hubPort}.`);
    });form

    // Prepopulating input tags with the current hub info
    let hubIpInput = document.getElementById('hub-ip');
    let hubPortInput = document.getElementById('hub-port');

    hubIpInput.value = getHubIp();

    hubPortInput.value = getHubPort();

    setInterval(() => {
        fetch(`http://${getHubIp()}:${getHubPort()}/api/connections`)
            .then(response => response.json())
            .then(json => {
                setConnectionStatus(json, 'conn-status');
            })
            .catch(error => {
                setConnectionStatus({hub: false}, 'conn-status');
            })
    }, 1000);

    setInterval(() => {
        fetch(formatHubURL("/api/plane/mavlink/status"))
            .then(r => checkRequest(r))
            .then(r => r.text())
            .then(text => {
                setConnectionStatus({jetson_mav: text}, 'jetson-conn-status', false);
            })
            .catch(err => {
                console.error(err);
                setConnectionStatus({jetson_mav: false}, 'jetson-conn-status');
            })
    }, 5000);

    pullMavlinkInfo();
    setupMavlinkEndpointSubmits();
    setupJetsonMavForm();
});