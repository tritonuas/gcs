class ImageGallery extends HTMLElement {
    constructor() {
        super();

        // Set up the Shadow dom
        const shadow = this.attachShadow({mode: 'open'});
        if (this.hasAttribute('width')) {
            this.width = this.getAttribute('width');
        } else {
            this.width = null;
        }

        if (this.hasAttribute('height')) {
            this.height = this.getAttribute('height');
        } else {
            this.height = null;
        }

        // Insert the styling into the doc
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', '../css/image-gallery.css');
        shadow.appendChild(link);

        // Add in where we output the current image
        const output = document.createElement('output');
        shadow.appendChild(output);

        this.img = document.createElement('img');
        this.img.id = "curr-img";
        if (this.width != null) {
            this.img.width = this.width;
        }
        if (this.height != null) {
            this.img.height = this.height;
        }
        output.appendChild(this.img);

        this.container = document.createElement('div');
        this.container.id = "bottom-bar-container";

        output.appendChild(this.container);

        this.label = document.createElement('p');
        this.label.innerText = '0/0';

        this.leftButton = document.createElement('button');
        this.leftButton.innerText = "<";
        this.leftButton.addEventListener('click', () => {this.swipe("left")});

        this.rightButton = document.createElement('button');
        this.rightButton.innerText = ">";
        this.rightButton.addEventListener('click', () => {this.swipe("left")});

        this.container.appendChild(this.leftButton);
        this.container.appendChild(this.label);
        this.container.appendChild(this.rightButton);

        this.imageList = [];
        this.currImage = -1;
    }

    setImage(src) {
        this.img.src = src;
        this.updateLabel();
    }

    swipe(direction) {
        if (this.currImage === -1) {
            return;
        }

        if (direction === "left") {
            this.currImage--;
            if (this.currImage < 0) {
                this.currImage = this.imageList.length - 1;
            }
        } else if (direction === "right") {
            this.currImage++;
            if (this.currImage == this.imageList.length) {
                this.currImage = 0;
            }
        }

        this.setImage(this.imageList[this.currImage]);
    }

    updateLabel() {
        this.label.innerText = `${this.currImage+1}/${this.imageList.length}`;
    }

    addImage(src, jsonCap) {
        this.imageList.push(src);
        this.currImage = this.imageList.length-1;
        this.setImage(src);
    }

    connectedCallback() {
    }

    disconnectedCallback() {
    }
}

customElements.define('image-gallery', ImageGallery);

class GalleryCaption extends HTMLElement {
    constructor() {
        this.style.display = 'block';
    }

    connectedCallback() {

    }
}

customElements.define('gallery-caption', GalleryCaption);