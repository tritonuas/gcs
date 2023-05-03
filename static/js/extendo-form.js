import { capitalizeFirstLetter } from "./util.js";
import { parseFormData } from "./mission-input.js";

class ExtendoForm extends HTMLElement {
    constructor() {
        super();
        this.numTuples = 0;
        this.baseFormHeight = "-1";
        this.lock = false;
        this.scrollTime = 150;

        this.values = [];
        // Parse data attributes
        if ('val1' in this.dataset) {
            this.val1 = this.dataset.val1;
            this.values.push(this.val1);
        }
        if ('val2' in this.dataset) {
            this.val2 = this.dataset.val2;
            this.values.push(this.val2);
        }
        if ('val3' in this.dataset) {
            this.val3 = this.dataset.val3;
            this.values.push(this.val3);
        }


        this.#setupForm();
        this.#adjustFormHeight(1);
        this.#addNewInputTuple(this.#makeNewTuple())
    }

    #adjustFormHeight(delta, override=false) {
        if (!override && this.numTuples <=1 && delta < 0) {
            this.lock = false;
            return false;
        }

        delta = delta * 2;
        let x = (parseInt(this.fieldset.style.height) + delta) + "em";
        this.fieldset.style.height = x;
        return true;
    }

    #updateCounter() {
        let counter = document.getElementById(`${this.id}-counter`);
        counter.value = this.numTuples;
    }

    #makeNewTuple(val1=null, val2=null, val3=null) {
        let currTupleNum = this.numTuples;
        this.numTuples++;
        this.#updateCounter();

        let div = document.createElement('div');
        div.classList.add('tuple');
        div.insertAdjacentHTML("beforeend", "<b>(</b>");
        let first = true;
        let i = 1;
        for (const val of this.values) {
            if (!first) {
                div.insertAdjacentHTML("beforeend", "<b>,</b>");
            } else {
                first = false;
            }

            let placeholder = capitalizeFirstLetter(val);
            let input = document.createElement('input');
            input.name = `${currTupleNum}-${val}`;
            input.id = `${this.id}${input.name}`
            input.placeholder = placeholder;

            // ahhhhhhhhhhhhh this code is getting soo baaaad
            switch (i) {
                case 1:
                    if (val1 != null) {
                        input.value = val1;
                    }
                    break;
                case 2:
                    if (val2 != null) {
                        input.value = val2;
                    }
                    break;
                case 3:
                    if (val3 != null) {
                        input.value = val3;
                    }
                    break;
            }

            div.appendChild(input);
            i++;
        }
        div.insertAdjacentHTML("beforeend", "<b>)</b>");
        return div;
    }

    #removeLastTuple() {
        if (this.numTuples <= 0) { return;}

        let child = this.tuplesList.children[this.tuplesList.children.length-1];
        this.tuplesList.removeChild(child);
        this.numTuples--;
        this.#updateCounter();
        this.lock = false;
    }

    #addNewInputTuple(pair) {
        this.tuplesList.appendChild(pair);
        this.lock = false;
    }

    #setupForm() {
        this.form = document.createElement('form');
        this.appendChild(this.form);

        this.fieldset = document.createElement('fieldset');
        let label = this.dataset.label;
        this.fieldset.style.height = '6em';
        this.fieldset.innerHTML = `
            <legend>${label}</legend>

            <ul style="display: flex; flex-direction: row">
                <input id="${this.id}-add-btn" type="button" value="Add">
                <input id="${this.id}-remove-btn" type="button" value="Remove">
                <input id="${this.id}-clear-btn" type="button" value="Clear">
                <input id="${this.id}-counter" class="counter" type="text" value="0">
                <input id="${this.id}-clone" type="button" type="text" value="Clone">
                <input id="${this.id}-clone-counter" class="counter" type="text" value="1">
            </ul>

            <ol id="${this.id}-tuple-list">

            </ol>

            <ul style="display: flex; flex-direction: row">
                <input id="${this.id}-submit-btn" type="submit" value="Submit">
            </ul>
        `;


        this.appendChild(this.fieldset);

        this.tuplesList = document.getElementById(`${this.id}-tuple-list`);

        let cloneBtn = document.getElementById(`${this.id}-clone`);
        cloneBtn.addEventListener('click', () => {
            let times = document.getElementById(`${this.id}-clone-counter`).value;
            this.clone(times);
        });


        let counter = document.getElementById(`${this.id}-counter`);
        counter.addEventListener('change', () => {
            let newVal = parseInt(counter.value);
            if (isNaN(newVal)) {
                counter.value = this.numTuples;
                return;
            }
            this.#changeSize(newVal);
        });

        this.baseFormHeight = this.fieldset.style.height;

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            let formData = new FormData(this.form);
            let formDataObj = {};
            formData.forEach((value, key) => (formDataObj[key] = value));
            this.submitFunc(formDataObj);
        });

        let addBtn = document.getElementById(`${this.id}-add-btn`);
        let removeBtn = document.getElementById(`${this.id}-remove-btn`);
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!this.lock) {
                this.lock = true;
                let tuple = this.#makeNewTuple();
                this.#adjustFormHeight(1);
                setTimeout(()=>{this.#addNewInputTuple(tuple)}, this.scrollTime);
            }
        });
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!this.lock) {
                this.lock = true;
                if (this.#adjustFormHeight(-1)) {
                    setTimeout(() => {this.#removeLastTuple()}, this.scrollTime);
                }
            }
        });
        let clearBtn = document.getElementById(`${this.id}-clear-btn`);
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.clear();
        });

        this.form.appendChild(this.fieldset);
    }

    #changeSize(newVal) {
        if (newVal > 50) {
            newVal = 50;
        }
        if (newVal <= 1) {
            newVal = 1;
        }
        let counter = document.getElementById(`${this.id}-counter`);
        counter.value = newVal;

        let delta = newVal - this.numTuples; // new - old
        if (delta < 0) {
            for (let i = 0; i < Math.abs(delta); i++) {
                this.#removeLastTuple();
            }
            setTimeout(()=> {
                this.#adjustFormHeight(delta, true);
            }, this.scrollTime);
        } else if (delta > 0) {
            this.#adjustFormHeight(delta);
            setTimeout(()=> {
                for (let i = 0; i < Math.abs(delta); i++) {
                    this.#addNewInputTuple(this.#makeNewTuple());
                }
            }, this.scrollTime*2);
        }
    }

    /* Public functions */

    setOnSubmit(func) {
        this.submitFunc = func;
    }

    clear() {
        this.#changeSize(1);
        let tuple = this.tuplesList.children[0];
        for (const child of tuple.children) {
            child.value = "";
        }
    }

    highlight(on) {
        if (on) {
            this.fieldset.style.backgroundColor = 'gold';
            this.fieldset.style.boxShadow = '0 0.5em 0.5em -0.4em gold';
            this.fieldset.style.transform = 'translateY(-0.25em)';
        } else {
            this.fieldset.style.backgroundColor = '';
            this.fieldset.style.boxShadow = '';
            this.fieldset.style.transform = '';
        }
    }

    setKeys(keys) {
        this.keys = keys;
    }

    clone(times) {
        let formData = new FormData(this.form);
        let formDataObj = {};
        formData.forEach((value, key) => (formDataObj[key] = value));

        let data = parseFormData(formDataObj, this.keys);
        let origData = [...data];
        for (let i = 1; i < times; i++) {
            data = data.concat(origData);
        }
        this.insertGenericData(this.keys, data, false);
    }

    // TODO: get rid of insertLatLngData and use this instead
    // TODO: make this class work with arbitary number of values (oh dear sorry if you have to do this in the future)
    // e.g.
    //
    // keys = ["latitude", "longitude", "altitude"]
    // values = [{"latitude": x, "longitude": y, "altitude":z}, {...}]
    insertGenericData(keys, values, clear=true) {
        if (clear) {
            this.clear();
        }

        let first = true;
        for (let i = 0; i < values.length; i++) {
            let data = [null, null, null]
            for (let j = 0; j < keys.length; j++) {
                data[j] = values[i][keys[j]];
            }
            if (first && clear) {
                first = false;
                let inputs = [];
                for (const key of keys) {
                    let input = document.getElementById(`${this.id}0-${key}`);
                    inputs.push(input);
                }
                for (let i = 0; i < keys.length; i++) {
                    inputs[i].value = values[0][keys[i]];
                }
            } else {
                let tuple = this.#makeNewTuple(data[0], data[1], data[2]);
                this.#addNewInputTuple(tuple);
            }
        }

        this.#adjustFormHeight(values.length-1);
    }

    // hyper specific function for these lat lon extendo forms
    insertLatLngData(data, mapMode) {
        // IF IT IS A FUCKING POLYGON IT COULD HAVE AN INNER RING SO THE DATA PARAMETER
        // WILL BE A LIST OF LISTS WHERE INDEX 0 IS WHAT WE ACTUALLY WANT
        if (mapMode == "search" || mapMode == "boundaries") {
            data = data[0];
            // i am incredibly sorry for that which i hath brought into this world
        } 

        let lat0input = document.getElementById(`${this.id}0-latitude`);
        let lon0input = document.getElementById(`${this.id}0-longitude`);
        lat0input.value = data[0].lat;
        lon0input.value = data[0].lng;

        this.#changeSize(1);
        let first = true;
        for (const latlng of data) {
            if (first) {
                first = false;
                continue;
            }
            let tuple = this.#makeNewTuple(latlng.lat, latlng.lng);
            this.#addNewInputTuple(tuple);
        }
        this.#adjustFormHeight(data.length-1);
    }
}
customElements.define('extendo-form', ExtendoForm);