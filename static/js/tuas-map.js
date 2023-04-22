import { alertDialog, getRandomInt, pasteDialog } from "./util.js";

import * as L from "../packages/leaflet-src.esm.js";

class TuasMap extends HTMLElement {
    /* 
        Private Helper Methods
    */
    #insertLeafletPackages() {
        const css = document.createElement('link');
        css.setAttribute('rel', 'stylesheet');
        css.setAttribute('href', '../packages/leaflet.css');
        this.shadow.appendChild(css);
        const script = document.createElement('script');
        script.setAttribute('type', 'module');
        script.setAttribute('src', '../packages/leaflet-src.esm.js');
        this.shadow.appendChild(script);
        const style = document.createElement('style');
        style.innerText = `
            div.map {
                transition: border 1s, transform 1s;
                border: 2px solid white;
            }
            div.map[mydisplay="false"] {
                display: none;
            }
            video {
                object-fit: fill;
            }
        `;
        this.shadow.appendChild(style);
    }

    #parseAttributes() {
        if (this.hasAttribute('width')) {
            this.width = this.getAttribute('width');
            this.style.width = this.width;
        }
        if (this.hasAttribute('height')) {
            this.height = this.getAttribute('height');
            this.style.height = this.height;
        }
        if (!('lat' in this.dataset)) {
            this.dataset.lat = 0;
        }
        if (!('lon' in this.dataset)) {
            this.dataset.lon = 0;
        }
        if (!('zoom' in this.dataset)) {
            this.dataset.zoom = 16;
        }
        if (!('max-zoom' in this.dataset)) {
            this.dataset.maxZoom = 18;
        }
    }

    #initMap() {
        this.map = document.createElement('div');
        this.map.style.width = this.width;
        this.map.style.height = this.height;
        this.map.classList.add('map');
        this.shadow.appendChild(this.map);

        this.familyguy = document.createElement('div');
        this.familyguy.innerHTML = `
            <video width="125%" height="${this.height}" loop>
                <source src="../videos/familyguy.mp4" type="video/mp4">
                Your browser does not support the video tag.
            </video>
            <video width="70%" height="${this.height}" loop>
                <source src="../videos/subway.mp4" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
        this.shouldAlert = true;
        this.familyguy.style.display = 'none';
        this.familyguy.style.height = this.height;
        this.familyguy.style.width = this.height;
        this.shadow.appendChild(this.familyguy);

        this.map = L.map(this.map).setView([this.dataset.lat, this.dataset.lon], this.dataset.zoom);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: this.dataset.maxZoom,
            id: 'mapbox/satellite-v9',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: 'pk.eyJ1IjoidGxlbnR6IiwiYSI6ImNsM2dwNmwzczBrb24zaXcxcWNoNWZjMjQifQ.sgAV6vkF7vOLC4P1_WkV_w'
        }).addTo(this.map);

        this.map.on('zoomend', () => {
            this.dataset.zoom = this.map.getZoom();
        });

        this.#addAllPolysToMap();
    }

    #killMap() {
        this.shadow.removeChild(this.map);
        this.map == null;
    }

    #initPolyIds() {
        this.idToPoly = new Map();
        this.idToMetadata = new Map();
        this.bin = new Map(); // container for all disconnected polies that can no longer be touched.
    }

    #addAllPolysToMap() {
        this.idToPoly.forEach((poly) => {
            poly.addTo(this.map);
        });
    }

    /* 
        Public Methods
    */

    addOnClick(func) {
        this.map.on('click', func);
    }

    // Create a poly and add it to the map if it is initialized
    //
    // id is the identfying string to set apart this poly
    // col is the color of all the lines
    // isLine = true means use Polyline behavior
    // isLine = false means use Polygon behavior
    initPoly(id, col, isLine) {
        let poly = null;
        if (isLine) {
            poly = L.polyline([], {color: col});
        } else {
            poly = L.polygon([], {color: col});
        }
        this.idToPoly.set(id, poly);
        this.idToMetadata.set(id, {"poly": true, "color": col, "isline": isLine});
        
        if (this.map != null) {
            poly.addTo(this.map);
        }
    }

    // Singular form of addPointsToPoly (below)
    addPointToPoly(id, point) {
        this.addPointsToPoly(id, [point]);
    }

    // Add a list of points to a polygon with specific id and color
    // 
    // id corresponds to the id of a poly that was instantiated by a call to initPoly(id, color)
    // Points in form [[lat0, lon0], [lat1, lon1], ...]
    // Continuous is a parameter relevant for polylines, but technically can work for polygons as well.
    // Continuous=true means that the line will continue
    // Continuous=false means that this point will not be connected to the previous line.
    //   In turn, this 
    addPointsToPoly(id, points) {

        if (!this.idToPoly.has(id)) {
            throw new Error(`Poly with id ${id} has not been initialized`);
        }

        let poly = this.idToPoly.get(id);

        for (const latlng of points) {
            poly.addLatLng(latlng);
        }

        if (id == "flight" || id == "search") {
            console.log(this.idToPoly.get(id));
        }
    }

    // Disconnect a poly from the id list and add it to the bin
    // under its id
    disconnectPoly(id) {
        let poly = this.idToPoly.get(id);
        if (this.bin.has(id)) {
            this.bin.get(id).push(poly);
        } else {
            this.bin.set(id, [poly]);
        }
        let metadata = this.idToMetadata.get(id);
        this.initPoly(id, metadata.color, metadata.isline); // reset idToPoly
    }

    // Remove all latng information from the poly, but still have inside the map
    clearPoly(id) {
        if (!(this.idToPoly.has(id))) {
            throw new Error(`Poly with id ${id} has not been initialized`);
        }

        this.idToPoly.get(id).setLatLngs([]);
    }

    // Remove the specified poly entirely
    removePoly(id) {
        if (!this.idToPoly.has(id)) {
            throw new Error(`Poly with id ${id} has not been initialized`);
        }

        if (this.map != null) {
            let poly = this.idToPoly[id];
            poly.removeFrom(this.map);
        }
        this.idToPoly.delete(id);
    }

    // Add a marker to the map with a specified id
    // Note: this id uses the same id space as polys, so there shouldn't be any collisons
    // In addition, it is an error to try to add points to a marker once it has been added to the map
    //
    // latlng in format [lat, lon]
    // url should be a relative filepath to the image
    // size should be in format [x, y]
    initMarker(id, latlng, url, size) {
        if (this.idToPoly.has(id)) {
            throw new Error(`ID ${id} already taken`);
        }

        let theIcon = L.icon({
            iconUrl: url,
            iconSize: size,
            iconAnchor: [size[0] / 2, size[1] / 2],
        });
        let marker = L.marker(latlng, {icon: theIcon});
        this.idToPoly.set(id, marker);
        this.idToMetadata.set(id, {"poly": false});
        
        if (this.map != null) {
            marker.addTo(this.map);
        }
    }
    
    // Move a marker with specified id to the specified location
    //
    // latlng in format [lat, lon]
    moveMarker(id, latlng) {
        if (!this.idToPoly.has(id)) {
            throw new Error(`No marker with ID ${id}`);
        }

        let marker = this.idToPoly.get(id);
        marker.setLatLng(latlng);
    }

    // Remove a marker by the specified id
    clearMarker(id) {
        if (!this.idToPoly.has(id)) {
            throw new Error(`No marker with ID ${id}`);
        }

        if (this.map != null) {
            let marker = this.idToPoly.get(id);
            marker.removeFrom(this.map);
        }
        this.idToPoly.delete(id);
    }

    // Center the map on position latlng with specified zoom
    //
    // latlng in format [lat, lon]
    centerMap(latlng) {
        this.dataset.lat = latlng[0];
        this.dataset.lon = latlng[1];

        if (this.dataset.lat == 0 && this.dataset.lon == 0) {
            this.setNoConn();
        } else {
            this.setConn();
        }
        if (this.map != null) {
            this.map.invalidateSize();
            this.map.setView(latlng, this.dataset.zoom);
        }

    }

    setNoConn() {
        if (this.shouldAlert) {
            alertDialog('Error: Plane Location Lost', true).addEventListener('close', () => {
                this.familyguy.style.display = 'flex';
                this.familyguy.style.flexDirection = 'row';
                this.familyguy.querySelectorAll('video').forEach((vid) => {vid.currentTime = getRandomInt(0, vid.duration); vid.play()});
                let map = this.shadow.querySelector("div.map");
                map.style.display = 'none';
            });
            this.shouldAlert = false;
        }

    }

    setConn() {
        this.familyguy.style.display = 'none';
        this.familyguy.querySelectorAll('video').forEach((vid) => {vid.pause()});
        let map = this.shadow.querySelector('div.map');
        map.style.display = 'flex';
        this.shouldAlert = true;
    }

    // Set zoom level of map
    //
    // newZoom is either the new zoom value, or how much to change the zoom value by
    // delta = false means the former, = true means the latter
    changeZoom(val, delta=true) {
        let newZoom;
        if (delta) {
            newZoom = this.dataset.zoom + val;
        } else {
            newZoom = val;
        }
        this.dataset.zoom = newZoom;
        if (this.map != null) {
            this.map.setView([this.dataset.lat, this.dataset.lon], newZoom);
        }
    }

    // Get the list of latlng associated with the given id
    getPolyLatLngs(id) {
        if (!this.idToPoly.has(id)) {
            throw new Error(`No poly with ID ${id}`);
        }

        return this.idToPoly.get(id).getLatLngs();
    }

    // Change border to gold
    highlight(on, resetzoom=true) {
        if (this.map == null) {
            return;
        }

        if (on) {
            const style = document.createElement("style");
            style.id = 'highlight-style';
            style.innerText = `
                div.map {
                    border: 2px solid gold !important;
                    transform: translateY(-0.5em);
                    box-shadow = '0 1.5em 1.5em -1.4em gold';
                }
            `;
            this.shadow.appendChild(style);
            this.oldZoom = this.dataset.zoom;
            this.changeZoom(2, false);
        } else {
            let style = this.shadow.getElementById('highlight-style');
            this.shadow.removeChild(style);
            if (resetzoom) {
                this.changeZoom(this.oldZoom, false);
            }
        }
    }

    // return true/false if the map is initialized
    isInitialized() {
        return this.map != null;
    }

    // Convert drawn data to json map so we can save the map data for later
    serialize() {
        let json = {};
        json["latitude"] = this.dataset.lat;
        json["longitude"] = this.dataset.lon;
        json["zoom"] = this.dataset.zoom;
        json["max-zoom"] = this.dataset.maxZoom;
        this.idToPoly.forEach((poly, id) => {
            let obj = {};
            let metadata = this.idToMetadata.get(id);
            if (metadata.poly) {
                obj["poly"] = true;
                obj["color"] = this.idToMetadata.get(id).color;
                let line = this.idToMetadata.get(id).isline;
                obj["isline"] = this.idToMetadata.get(id).isline;
                obj["latlngs"] = poly.getLatLngs();
                if (!line) {
                    obj["latlngs"] = obj["latlngs"][0];
                    // because getLatLngs returns differently if it is a polygon or a polyline
                }
                if (this.bin.has(id)) {
                    obj["bin"] = this.bin.get(id);
                }
            } else {
                obj["poly"] = false;
                obj["latlng"] = poly.getLatLng();
                obj["icon"] = poly.getIcon()["options"];
                // TODO: store marker data
            }
            json[id] = obj;
        });
        pasteDialog("Copy Map JSON Below:", JSON.stringify(json));
        return json;
    }

    load(json) {
        // TODO:
        let lat = json["latitude"], lon = json["longitude"];
        this.centerMap([lat, lon]);
        this.changeZoom(json["zoom"], false);
        for (const key of Object.keys(json)) {
            switch (key) {
                case "latitude":
                case "longitude":
                case "zoom":
                case "max-zoom":
                    // handled above
                    break;
                default:

            }
        }

    }

    /*
        Special Methods
    */
    constructor() {
        super();

        this.shadow = this.attachShadow({mode: 'open'});
        this.map == null;
        this.#insertLeafletPackages();
        this.#initPolyIds();
    }

    connectedCallback() {
        this.#parseAttributes();
        this.#initMap();
    }

    disconnectedCallback() {
        this.#killMap();
    }
}

customElements.define('tuas-map', TuasMap);