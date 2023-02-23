import {getRandomInt, important} from "./util.js"

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
        this.shadow = this.attachShadow({mode: 'open'});

        const nav = document.createElement('nav');
        const ul = document.createElement('ul');
        const link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('href', '../css/navbar.css');
        this.shadow.appendChild(link);
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
        ul.appendChild(getNavSection('jetson-debug.html',  'Jetson'));

        this.shadow.appendChild(nav);
    }

    connectedCallback() {
        setInterval(() => {
            if (Math.random() < 0.001 && document.hasFocus()) {
                const SWARM_COUNT = 10;
                let numPlanes = 0;

                let swarmInterval = setInterval(() => {
                    let plane = document.createElement('img');
                    plane.src='../images/plane.gif';
                    plane.width="16px";
                    plane.height="16px";
                    plane.style = `
                        z-index: 1000; top: ${getRandomInt(0, screen.availHeight)}px;
                        animation-name: fly; animation-duration: ${getRandomInt(5,20)}s; animation-timing-function: linear;
                        position: absolute; display: block; width: 32px; height: 32px;`
                        ;
                    let body = document.getElementsByTagName('body')[0];
                    body.appendChild(plane);
                    plane.addEventListener('animationend', () => {
                        body.removeChild(plane);
                    })
                    numPlanes++;
                    if (numPlanes > SWARM_COUNT) {
                        clearInterval(swarmInterval);
                    }
                }, 100);
            }
        }, 1000);
    }
}

customElements.define('nav-bar', Navbar);