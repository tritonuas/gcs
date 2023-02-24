import { connectToLocationWorker, alertDialogCursed, getRandomInt } from "./util.js";

connectToLocationWorker();

let titleMusic = new Audio('../music/title.webm');
titleMusic.loop = true;
let normalMusic = new Audio('../music/normal.webm');
normalMusic.loop = true;
let intenseMusic = new Audio('../music/intense.webm');
intenseMusic.loop = true;

let musics = [intenseMusic];

let explosionSound = new Audio('../music/blow.wav');
let dropSound = new Audio('../music/drop.wav');

let currSection = null;
let currMusic = null;
let currLevel = -1;

function collision(a, b) {
    const rect1 = a.getBoundingClientRect();
    const rect2 = b.getBoundingClientRect();
    const isInHoriztonalBounds =
        rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x;
    const isInVerticalBounds =
        rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    const isOverlapping = isInHoriztonalBounds && isInVerticalBounds;
    return isOverlapping;
}

function getDirFrom(a, b) {
    const rect1 = a.getBoundingClientRect();
    const rect2 = b.getBoundingClientRect();
    const isLeft = rect1.x < rect2.x;
    const isBelow = rect1.y > rect2.y;
    return {"left": isLeft, "below": isBelow};
}

function offset(player) {
    const playerrect = player.getBoundingClientRect();
    return {"x": playerrect.x + Math.random() * 1000, "y": playerrect.y + Math.random() * 1000};
}

function createExplosion(top, left) {
    let explosion = document.createElement('img');
    explosionSound.currentTime = 0;
    explosionSound.play();
    explosion.classList.add('explosion')
    explosion.src= "../images/explosion.gif";
    explosion.style = `left: ${left-100}px; top: ${top-100}px;`;
    explosion.width = 200;
    explosion.height = 200;
    currSection.appendChild(explosion);
    if (collision(explosion, gamePlane.tag)) {
        currSection.removeChild(gamePlane.tag);
    }
    setTimeout(() => {
        currSection.removeChild(explosion);
    }, 850);
}

class GamePlane {
    #vx = 0;
    #vy = 0;
    #ax = 0
    #ay = 0
    constructor(tag, player) {
        this.tag = tag;
        this.canBomb = true;
        this.player = player;
    }

    // The looping function that moves the plane in current velocity
    move() {
        const X_MAX = 100;
        const Y_MAX = 150;
        const Y_MIN = -50;
        // left -> negative
        // right -> positive
        // up -> negative
        // down -> positive

        this.#vx += this.#ax;
        if (Math.abs(this.#vx) > X_MAX) {
            if (this.#vx < 0) {
                this.#vx = -X_MAX;
            } else {
                this.#vx = X_MAX;
            }
        }
        
        let ayAdj = 0;
        const FALL_THRES = 10;
        if (Math.abs(this.#vx) < FALL_THRES) {
            ayAdj = 0.5;
        }

        this.#vy += this.#ay + ayAdj;
        if (this.#vy > Y_MAX) {
            this.#vy = Y_MAX;
        } else if (this.#vy < Y_MIN) {
            this.#vy = Y_MIN;
        }

        // wind/gravity
        this.#vy += 0.1;

        this.#place(this.left()+(this.#vx*0.1), this.top()+(this.#vy*0.1));

        if (this.#vx < 0) {
            this.#face("left");
        } else {
            this.#face("right");
        }
        const TILT_THRES = Math.abs(Y_MIN * 0.25);
        if (this.#vy < -TILT_THRES) {
            this.#tilt("up");
        } else if (this.#vy > TILT_THRES){
            this.#tilt("down");
        } else {
            this.#tilt("none");
        }

    }

    bomb() {
        if (this.canBomb) {
            this.canBomb = false;

            let bomb = document.createElement('img');
            dropSound.currentTime = 0;
            dropSound.play();
            bomb.src="../images/bottle.png";
            bomb.style = `position: absolute; left: ${this.left()}px; top: ${this.top()}px;`;
            bomb.width = 16;
            bomb.height = 32;
            currSection.appendChild(bomb);
            let vi = Math.max(this.#vy, 0);
            let startTime = Date.now(); // ms unix time
            var bombInterval = setInterval(() => {
                let y = parseFloat(bomb.style.top) + 25 + (.1 * vi);
                bomb.style.top = `${y}px`;
                let breakerson = false;
                enemies.forEach((e) => {
                    if (collision(bomb, e.tag)) {
                        currSection.removeChild(e.tag);
                        currSection.removeChild(bomb);
                        createExplosion(parseFloat(bomb.style.top), parseFloat(bomb.style.left));
                        clearInterval(bombInterval);
                        this.canBomb = true;
                        enemies.delete(e);
                        breakerson = true;
                        return;
                    }
                });
                if (breakerson) {
                    return;
                }
                if (Date.now() - startTime > 2000) {
                    currSection.removeChild(bomb);
                    createExplosion(parseFloat(bomb.style.top), parseFloat(bomb.style.left));
                    clearInterval(bombInterval);
                    this.canBomb = true;
                }
            }, 25)
        }
    }

    setXAccel(amount) {
        this.#ax = amount;
    }
    setYAccel(amount) {
        this.#ay = amount;
    }

    #place(x, y) {
        this.tag.style.left = `${x}px`;
        this.tag.style.top = `${y}px`;
        if (this.player) {
            this.tag.scrollIntoView({
                behavior: 'auto',
                block: 'center',
                inline: 'center'
            });
        }

        //window.scroll({top: this.top() - (window.innerHeight / 2), left: this.left()- (window.innerHeight / 2)});
    }

    #face(dir) {
        this.tag.dataset.dir = dir;
    }

    #tilt(dir) {
        this.tag.dataset.tilt = dir;
    }

    left() {
        return parseFloat(this.tag.style.left);
    }

    top() {
        return parseFloat(this.tag.style.top);
    }
}

let gamePlane = null;
let enemies = new Set();

function initTitle() {
    // init button listen handlers
    let startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        setCurrSection(document.getElementById('game-section'), musics[getRandomInt(0, musics.length)]);
    });
    let returnBtn = document.getElementById('return-btn');
    returnBtn.addEventListener('click', () => {
        window.location.href = '/html/connection.html';
    });
}

function initGame() {
    gamePlane = new GamePlane(document.getElementById('game-plane'),true);

    let enemyPlane = new GamePlane(document.getElementById('enemy'),false);
    enemies.add(enemyPlane);

    // set up event listeners 
    let gameSection = document.getElementById('game-section');
    window.addEventListener('keydown', (e) => {
        e.preventDefault();
        if (gameSection.dataset.active=="true") {
            switch (e.key) {
                case "ArrowLeft":
                    gamePlane.setXAccel(-1);
                    break;
                case "ArrowRight":
                    gamePlane.setXAccel(1);
                    break;
                case "ArrowUp":
                    gamePlane.setYAccel(-1);
                    break;
                case "ArrowDown":
                    gamePlane.setYAccel(1);
                    break;
                case " ":
                    gamePlane.bomb();
                    break;
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        e.preventDefault();
        if (gameSection.dataset.active=="true") {
            switch (e.key) {
                case "ArrowLeft":
                    gamePlane.setXAccel(0);
                    break;
                case "ArrowRight":
                    gamePlane.setXAccel(0);
                    break;
                case "ArrowUp":
                    gamePlane.setYAccel(0);
                    break;
                    break;
                case "ArrowDown":
                    gamePlane.setYAccel(0);
                    break;
                case " ":
                    break;
            }
        }
    });

    let i = 0;
    setInterval(() => {
        if (gameSection.dataset.active=="true") {
            gamePlane.move();
            enemies.forEach((enemyPlane) => {
                if (i % 100 == 0) {
                    let dir = getDirFrom(gamePlane.tag, enemyPlane.tag);
                    if (dir.left) {
                        enemyPlane.setXAccel(-1);
                    } else {
                        enemyPlane.setXAccel(1);
                    }
                    if (dir.below) {
                        enemyPlane.setYAccel(1);
                    } else {
                        enemyPlane.setYAccel(-1);
                    }
                }
                enemyPlane.move();
            });
            if (enemies.size < 1) {
                let off = offset(gamePlane.tag);
                console.log(off);
                gameSection.insertAdjacentHTML("beforeend", `
                    <img class="plane" id="enemy${i}" 
                    data-dir="left" src="../images/noooo.gif" 
                    width="128" height="128" style="left: ${off.x}px; top: $${off.y}px;">
                `);
                let enemyTag = document.getElementById(`enemy${i}`);
                let enemyPlane = new GamePlane(enemyTag, false);
                enemies.add(enemyPlane);
            }
        }
    }, 10);
}

function hideCurrSection() {
    if (currMusic != null) {
        currMusic.pause();
    }
    if (currSection != null) {
        currSection.dataset.active = "false";
    }
}

function showCurrSection() {
    currSection.dataset.active = "true";
    currMusic.play();
}

function setCurrSection(newSection, newMusic) {
    hideCurrSection();
    currSection = newSection;
    currMusic = newMusic;
    showCurrSection();
}

document.addEventListener('DOMContentLoaded', () => {
    alertDialogCursed('"𝖂𝖍𝖆𝖙 𝕳𝖆𝖙𝖍 𝕲𝖔𝖉 𝖂𝖗𝖔𝖚𝖌𝖍𝖙?"', true).addEventListener('close', () => {
        setCurrSection(document.getElementById('title-section'), titleMusic);
    });

    initTitle();
    initGame();
});

/*
logo.addEventListener("click", () => {
    logo.classList.add("follow");

    new Audio('../images/duck-flies.webm').play();
    document.addEventListener('mousemove', (e) => {
        if (!keepMoving) {
            return;
        }

        logo.style.left = e.pageX + 'px';
        logo.style.top = e.pageY + 'px';

        let height = document.getElementsByTagName('html')[0].offsetHeight;

        if (e.pageY > height-32) {
            keepMoving = false;
            logo.style = "z-index: 999999999999999999999999; width: 200px; height: 200px; background-image: url(../images/explosion.gif)";
            logo.style.left = e.pageX - 100 + 'px';
            logo.style.top = e.pageY - 100 + 'px';
            setTimeout(() => {ul.removeChild(logo)}, 800);
        }
    });
});
*/