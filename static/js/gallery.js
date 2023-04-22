// TODO: make the current image gallery implementation use this and delete image-gallery.js, image-gallery.css
class Gallery extends HTMLElement {
    constructor() {
        super();

        // Add in where we output the current image
        const output = document.createElement('output');
        output.style = `display: flex; flex-direction: row; justify-content: center; align-items: center;`

        // Container for the user's object they are putting into the gallery
        this.elemContainer = document.createElement('div'); 

        this.elemList = [];
        this.currElem = -1;


        // Create the two buttons
        this.leftBtn = document.createElement('input');
        this.leftBtn.value = "⟵";
        this.leftBtn.type = "button";
        this.leftBtn.classList.add("swipe-gallery-left");
        this.rightBtn = document.createElement('input');
        this.rightBtn.value = "⟶";
        this.rightBtn.type = "button";
        this.rightBtn.classList.add("swipe-gallery-right");
        this.leftBtn.addEventListener('click', () => {this.swipeLeft()});
        this.rightBtn.addEventListener('click', () => {this.swipeRight()});

        // put left button, then elemContainer, then right button

        output.appendChild(this.leftBtn);
        output.appendChild(this.elemContainer);
        output.appendChild(this.rightBtn);

        this.appendChild(output);
    }

    addElem(elem) {
        elem.style = 'display: none';
        this.elemList.push(elem);
        this.elemContainer.appendChild(elem);
        if (this.currElem == -1) {
            elem.style = ''
            this.currElem = 0;
        }
    }

    swipeLeft() {
        this.elemList[this.currElem].style = 'display: none';
        this.currElem--;
        if (this.currElem < 0) {
            this.currElem = this.elemList.length-1;
        }
        this.elemList[this.currElem].style = '';
    }

    swipeRight() {
        this.elemList[this.currElem].style = 'display: none';
        this.currElem++;
        if (this.currElem >= this.elemList.length) {
            this.currElem = 0;
        }
        this.elemList[this.currElem].style = '';
    }

    getCurrElem() {
        return this.elemList[this.currElem];
    }

    connectedCallback() {
        document.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft") {
                this.leftBtn.dataset.active = "true";
            } else if (e.key === "ArrowRight") {
                this.rightBtn.dataset.active = "true";
            }
        });
        document.addEventListener("keyup", (e) => {
            if (e.key === "ArrowLeft") {
                this.leftBtn.dataset.active = "false";
            } else if (e.key === "ArrowRight") {
                this.rightBtn.dataset.active = "false";
            }
        });
    }

    disconnectedCallback() {
    }
}

customElements.define('swipe-gallery', Gallery);