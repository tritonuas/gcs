import {important} from "./util.js"

function getNavSection(page, text, isDefault=false) {
    // Create the right a tag
    const anchor = document.createElement('a');
    anchor.href = `/html/${page}`;
    anchor.innerText = text;

    // first case is because you can be on index.html without the url saying /index.html
    if ((window.location.pathname === "/" && isDefault) ||
        (window.location.href.split('?')[0] === anchor.href)) {
        anchor.style.backgroundColor = 'blue';
        anchor.style.border = '1px lightblue solid';
    }

    // Create the li tag that the a tag goes inside of
    const li = document.createElement('li');
    li.appendChild(anchor);


    // Return the list item
    return li;
}

class Navbar extends HTMLElement {
    constructor() {
        super();

        important();

        // Set up the Shadow dom
        const shadow = this.attachShadow({mode: 'open'});

        const nav = document.createElement('nav');
        const ul = document.createElement('ul');
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', '../css/navbar.css');
        shadow.appendChild(link);
        nav.appendChild(ul);

        /*
        // stupid shit
        document.addEventListener('keydown', (e) => {
            console.log(e.key)
            if (e.key === "p") {
                let allElems = document.querySelectorAll("*");
                for (const elem of allElems) {
                    elem.style = 'animation: waitSpin .5s alternate infinite;'
                }
            } 
        });
        */

        const logo = document.createElement('div');
        logo.classList.add('logo');
        ul.appendChild(logo);
        logo.addEventListener("click", () => {
            new Audio('../music/title.webm').play();
            window.location.href = '/html/game.html';
        });

        // Put in links
        ul.appendChild(getNavSection('connection.html', 'Connections'));
        ul.appendChild(getNavSection('mission-control.html', 'Control'));
        ul.appendChild(getNavSection('mission-input.html', 'Input'));
        ul.appendChild(getNavSection('mission-report.html',  'Report'));
        ul.appendChild(getNavSection('jetson-debug.html',  'Camera'));

        shadow.appendChild(nav);
    }
}

customElements.define('nav-bar', Navbar);