class ValueGauge extends HTMLElement {
    constructor() {
        super();

        this.oldValue = null;

        // Set up the Shadow dom
        const shadow = this.attachShadow({mode: 'open'});

        if (this.hasAttribute('label')) {
            this.label = this.getAttribute('label');
        } else {
            this.label = '';
        }

        if (this.hasAttribute('unit')) {
            this.unit = this.getAttribute('unit');
        } else {
            this.unit = '';
        }

        // Insert the styling into the doc
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', '../css/value-gauge.css');
        shadow.appendChild(link);

        // Add in where we output the value
        const output = document.createElement('output');
        output.dataset.null = false;
        output.innerHTML = `<b>${this.label}</b><hr>...`;
        shadow.appendChild(output);
    }

    setValue(val, displayUnit=true) {
        const output = this.shadowRoot.querySelector('output');
        if (this.oldValue == val) { return; }
        let time = 0;
        if (this.oldValue == null) {
            let img = output.querySelector('img');
            if (img != null) {
                time=500;
                img.src = "../images/thumbsup.png";
            }
        }

        setTimeout(() => {
            const labelText = this.label !== null ? this.label : "";
            output.innerHTML = `<b>${labelText}</b><hr>${val} ${displayUnit ? this.unit : ""}`;
            this.oldValue = val;
            output.dataset.null = false;
            output.dataset.changed = true;
            setTimeout(() => {output.dataset.changed = false}, 900);
        }, time);
    }

    setNull() {
        const output = this.shadowRoot.querySelector('output');
        if (output.dataset.null == "true") {
            return;
        }
        this.oldValue = null;
        const labelText = this.label !== null ? this.label : "";
        output.innerHTML = `<b>${labelText}</b><hr><img src="../images/noooo.gif" width=48 height=48>`;
        let img = output.querySelector("img");
        if (img != null && img != undefined) {
            img.style.animationDuration = `${Math.random()+0.1}s`;
        }
        output.dataset.null = true;
    }

    connectedCallback() {
    }

    disconnectedCallback() {
    }
}

customElements.define('val-gauge', ValueGauge);