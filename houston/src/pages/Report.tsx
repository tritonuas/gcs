import React from "react"
import TuasMap from '../components/TuasMap.tsx'
import "./Report.css"
import img1 from '../assets/report-page-images/amogus-1.png'
import img2 from '../assets/report-page-images/amogus-2.png'
import img3 from '../assets/report-page-images/amogus-3.png'
import img4 from '../assets/report-page-images/amogus-4.png'
import img5 from '../assets/report-page-images/amogus-5.png'
import L from 'leaflet';

export type item = typeof item1;

interface ImageProps {
    item: item;
}

/**
 * @param props props
 * @param props.item image to be displayed
 * @returns image container
 */
function Image({item}: ImageProps) {
    const match = itemArray.find((itemX) => itemX.alphanumeric === item.alphanumeric && itemX.shape === item.shape && itemX.alphanumericColor === item.alphanumericColor && itemX.shapeColor === item.shapeColor);
    const matchColor = itemArray.find((itemX) => itemX.id === item.id)?.alphanumericColor;
    const backgroundColor = {backgroundColor: matchColor};
    return match ? (
        <div className="image-container" style={backgroundColor}>
            <img className="image" src={item.image} alt={"sus"} />
            {item.bottleLetter !== "null" ?<p className="image-data">Bottle Letter: {item.bottleLetter}</p> : null}
            <p className="image-data">Latitude {item.lat}</p>
            <p className="image-data">Longitude {item.lng}</p>
            <p className="image-data">Alphanumeric: {item.alphanumericColor} {item.alphanumeric}</p>
            <p className="image-data">Shape: {item.shapeColor} {item.shape}</p>
        </div>
    )
    : 
    <div className="image-container">
        <img className="image" src={item.image} alt={"sus"} />
        {item.bottleLetter !== "null" ?<p className="image-data">Bottle Letter: {item.bottleLetter}</p> : null}
        <p className="image-data">Latitude {item.lat}</p>
        <p className="image-data">Longitude {item.lng}</p>
        <p className="image-data">Alphanumeric: {item.alphanumericColor} {item.alphanumeric}</p>
        <p className="image-data">Shape: {item.shapeColor} {item.shape}</p>
    </div>;
}

class Item {
    id: number;
    lat: number;
    lng: number;
    image: string;
    bottleLetter: string;
    alphanumeric: string;
    alphanumericColor: string;
    shape: string;
    shapeColor: string;

    constructor(id: number, lat: number, lng: number, image: string, bottleLetter: string, alphanumeric: string, alphanumericColor: string, shape: string, shapeColor: string) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.image = image;
        this.bottleLetter = bottleLetter;
        this.alphanumeric = alphanumeric;
        this.alphanumericColor = alphanumericColor;
        this.shape = shape;
        this.shapeColor = shapeColor;
    }
}

const itemA = new Item(1, 1.3467, 103.9326, img1, "A",  "A", "red", "Circle", "blue");
const itemB = new Item(2, 1.3467, 103.9326, img2, "B",  "B", "blue", "Square", "red");
const itemC = new Item(3, 1.3467, 103.9326, img3, "C",  "C", "green", "Triangle", "yellow");
const itemD = new Item(4, 1.3467, 103.9326, img4, "D",  "D", "yellow", "Circle", "green");
const itemE = new Item(5, 1.3467, 103.9326, img5, "E",  "E", "purple", "Square", "purple");

const item1 = new Item(1, 1.391554, 103.889433, img1, "null",  "A", "red", "Circle", "blue");
const item2 = new Item(2, 1.354214, 103.883808, img2, "null",  "A", "blue", "Square", "red");
const item3 = new Item(3, 1.348574, 103.635766, img3, "null",  "B", "green", "Triangle", "yellow");
const item4 = new Item(4, 1.3467, 103.9326, img4, "null",  "C", "yellow", "Circle", "green");
const item5 = new Item(5, 1.358, 103.9326, img5, "null",  "D", "purple", "Square", "purple");

const item6 = new Item(1, 1.3467, 103.9326, img1, "null",  "B", "red", "Circle", "blue");
const item7 = new Item(2, 1.3467, 103.9326, img2, "null",  "B", "blue", "Square", "red");
const item8 = new Item(3, 1.3467, 103.9326, img3, "null",  "A", "green", "Triangle", "yellow");
const item9 = new Item(4, 1.3467, 103.9326, img4, "null",  "C", "yellow", "Circle", "green");
const item10 = new Item(5, 1.3467, 103.9326, img5, "null",  "E", "purple", "Square", "purple");

const item11 = new Item(1, 1.3467, 103.9326, img1, "null",  "E", "red", "Circle", "blue");
const item12 = new Item(2, 1.3467, 103.9326, img2, "null",  "D", "blue", "Square", "red");
const item13 = new Item(3, 1.3467, 103.9326, img3, "null",  "C", "green", "Triangle", "yellow");
const item14 = new Item(4, 1.3467, 103.9326, img4, "null",  "B", "yellow", "Circle", "green");
const item15 = new Item(5, 1.3467, 103.9326, img5, "null",  "A", "purple", "Square", "purple");

const item16 = new Item(1, 1.3467, 103.9326, img1, "null",  "E", "red", "Circle", "blue");
const item17 = new Item(2, 1.3467, 103.9326, img2, "null",  "D", "blue", "Square", "red");
const item18 = new Item(3, 1.3467, 103.9326, img3, "null",  "B", "green", "Triangle", "yellow");
const item19 = new Item(4, 1.3467, 103.9326, img4, "null",  "D", "yellow", "Circle", "green");
const item20 = new Item(5, 1.3467, 103.9326, img5, "null",  "A", "purple", "Square", "purple");

const foundItemArray = [item1, item2, item3, item4, item5, item6, item7, item8, item9, item10, item11, item12, item13, item14, item15, item16, item17, item18, item19, item20];

const itemArray = [itemA, itemB, itemC, itemD, itemE];

const matchedItems = foundItemArray.filter(itemTwo => 
    itemArray.some(itemOne => itemOne.alphanumeric === itemTwo.alphanumeric && itemOne.shape === itemTwo.shape && itemOne.alphanumericColor === itemTwo.alphanumericColor && itemOne.shapeColor === itemTwo.shapeColor)
);

const unmatchedItems = foundItemArray.filter(itemTwo => 
    !itemArray.some(itemOne => itemOne.alphanumeric === itemTwo.alphanumeric && itemOne.shape === itemTwo.shape && itemOne.alphanumericColor === itemTwo.alphanumericColor && itemOne.shapeColor === itemTwo.shapeColor)
);

/**
 * @returns report page
 */
function Report() {
    const [matched, setMatched] = React.useState(true);
    const [unmatched, setUnmatched] = React.useState(true);

    const matchedStyle = matched ? {backgroundColor: "var(--highlight)"} : {backgroundColor: "#808080", boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.75) inset"};
    const unmatchedStyle = unmatched ? {backgroundColor: "var(--highlight)"} : {backgroundColor: "#808080", boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.75) inset"};

    const matchedArray = matched ? matchedItems : [];
    const unmatchedArray = unmatched ? unmatchedItems : [];

    const matchedIcons = matched ? matchedArray.map(item =>
        L.icon({
            iconUrl: item.image,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        })
    ) : [];

    const unmatchedIcons = unmatched ? unmatchedArray.map(item =>
        L.icon({
            iconUrl: item.image,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        })
    ) : [];

    const handleMatched = () => {
        setMatched(prevMatched => !prevMatched);
    }
    
    const handleUnmatched = () => {
        setUnmatched(prevUnmatched => !prevUnmatched);
    }
    
  return (
    <main className="report-page">
        <div className="checkbox-container">
                <div className="checkbox">
                    <p className="checkbox-text" style={unmatchedStyle} onClick={handleUnmatched}>Unmatched Targets</p>
                </div>
                <div className="checkbox">
                    <p className="checkbox-text" style={matchedStyle} onClick={handleMatched}>Matched Targets</p>
                </div>
        </div>
        <div className="left-container">
            <div className="gallery-container">
                <div className="unmatched-gallery">
                    {foundItemArray.map((item) => <Image key={item.id} item={item}/>)}
                </div>
                <div className="matched-gallery">
                    {itemArray.map((item) => <Image key={item.id} item={item}/>)}
                </div>
            </div>
            <TuasMap className={'report-page-map'} lat={1.3467} lng={103.9326} matchedArray={matchedArray} unmatchedArray={unmatchedArray} matchedIcons={matchedIcons} unmatchedIcons={unmatchedIcons}/>
        </div>
    </main>
  )
}

export default Report;