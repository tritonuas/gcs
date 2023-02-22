class GrowBox extends HTMLElement {
    constructor() {
        super();

        this.style.display = 'block';
        this.style.transition = 'height 0.5s';
        this.style.height = 0;
        this.style.overflow = 'hidden';
    }

    connectedCallback() {
        let wrapper = document.createElement("div");
        wrapper.classList.add("grow-box-wrapper");

        // copy over to shadow dom
        for (let i = 0; i < this.children.length; i++) {
            let child = this.children[i];
            if (child.tagName.toUpperCase() != "GROW-BTN") {
                wrapper.appendChild(child);
            }
        }

        let growBtn = this.querySelector('grow-btn');
        growBtn.innerText = growBtn.dataset.off;

        this.innerHTML = '';

        this.appendChild(wrapper);
        this.insertAdjacentElement("beforebegin", growBtn);

        growBtn.addEventListener("click", () => {
            if (this.clientHeight) {
                this.style.height = 0;
                growBtn.innerText = growBtn.dataset.off;
            } else {
                let wrapper = this.children[0]; // has to be the wrapper
                this.style.height = (wrapper.clientHeight * 1.25) + "px";
                growBtn.innerText = growBtn.dataset.on;
            }
        });
    }

    disconnectedCallback() {
    }
}

customElements.define('grow-box', GrowBox);

class GrowBtn extends HTMLButtonElement{
    constructor() {
        super();


    }

    connectedCallback() {

    }
}

customElements.define('grow-button', GrowBtn);