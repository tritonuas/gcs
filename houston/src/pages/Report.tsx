import React from "react"
import TuasMap from '../components/TuasMap.tsx'
import "./Report.css"
import img1 from '../assets/report-page-images/amogus-1.png'
import img2 from '../assets/report-page-images/amogus-2.png'
import img3 from '../assets/report-page-images/amogus-3.png'
import img4 from '../assets/report-page-images/amogus-4.png'
import img5 from '../assets/report-page-images/amogus-5.png'
import L from 'leaflet';
import Button from '@mui/material-next/Button';
import { red, blue, green, yellow, purple, grey } from '@mui/material/colors';

export type item = typeof itemA;

type UpdateItemFunction = (index: number, newId: number) => void;

interface ImageProps {
    item: item;
    constItems: item[];
    foundItemIndex: number;
    updateItem: UpdateItemFunction;
}

const button_colors = [red[300], blue[300], green[500], yellow[700], purple[300]];

/**
 * @param props props
 * @param props.item image to be displayed
 * @param props.constItems array of items that we are comparing against
 * @param props.foundItemIndex index of the item in the foundItemArray
 * @param props.updateItem function to update the item
 * @returns image container
 */
function Image({item, constItems, foundItemIndex, updateItem}: ImageProps) {
    const reassignHandler = () => {
        const value = prompt('Enter new Bottle ID');
        let id = item.id;
        if (value !== null) {
            id = parseInt(value);
        }
        updateItem(foundItemIndex, id);
    }
    const match = constItems.find((itemX) => itemX.id === item.id);
    const matchColor = constItems.find((itemX) => itemX.id === item.id)?.boxColor;
    const matchIndex = constItems.findIndex((itemX) => itemX.id === item.id);
    const backgroundColor = {backgroundColor: matchColor};
    return match ? (
        <div className="image-container" style={backgroundColor}>
            <img className="image" src={item.image} alt={"sus"} />
            <p className="image-data-lat-long">[{item.lat}, {item.lng}]</p>
            {item.bottleLetter !== "null" ?<p className="image-data"><b>Bottle Letter:</b> {item.bottleLetter}</p> : null}
            <p className="image-data"><b>Alphanumeric:</b> {item.alphanumericColor} {item.alphanumeric}</p>
            <p className="image-data"><b>Shape:</b> {item.shapeColor} {item.shape}</p>
            {item.bottleLetter == "null" ?
                <Button 
                    className='button' 
                    size="small" 
                    variant="filledTonal" 
                    sx={{ backgroundColor: button_colors[matchIndex]}} 
                    onClick={reassignHandler}>
                    Reassign
                </Button> 
            : null}
        </div>
    )
    : 
    <div className="image-container">
        <img className="image" src={item.image} alt={"sus"} />
        <p className="image-data-lat-long">[{item.lat}, {item.lng}]</p>
        {item.bottleLetter !== "null" ?<p className="image-data"><b>Bottle Letter:</b> {item.bottleLetter}</p> : null}
        <p className="image-data"><b>Alphanumeric:</b> {item.alphanumericColor} {item.alphanumeric}</p>
        <p className="image-data"><b>Shape:</b> {item.shapeColor} {item.shape}</p>
        {item.bottleLetter == "null" ?
            <Button 
                className='button' 
                size="small" 
                variant="filledTonal" 
                sx={{ backgroundColor: grey[500]}} 
                onClick={reassignHandler}>
                Reassign
            </Button> 
        : null}
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
    boxColor: string;

    constructor(id: number, lat: number, lng: number, image: string, bottleLetter: string, alphanumeric: string, alphanumericColor: string, shape: string, shapeColor: string, boxColor: string) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.image = image;
        this.bottleLetter = bottleLetter;
        this.alphanumeric = alphanumeric;
        this.alphanumericColor = alphanumericColor;
        this.shape = shape;
        this.shapeColor = shapeColor;
        this.boxColor = boxColor;
    }
}

const itemA = new Item(1, 1.3467, 103.9326, img1, "A",  "A", "red", "Circle", "blue", "lightsalmon");
const itemB = new Item(2, 1.3467, 103.9326, img2, "B",  "B", "blue", "Square", "red", "lightblue");
const itemC = new Item(3, 1.3467, 103.9326, img3, "C",  "C", "green", "Triangle", "yellow" , "lightgreen");
const itemD = new Item(4, 1.3467, 103.9326, img4, "D",  "D", "yellow", "Circle", "green", "khaki");
const itemE = new Item(5, 1.3467, 103.9326, img5, "E",  "E", "purple", "Square", "purple", "plum");


/**
 * @returns report page
 */
function Report() {
    const [foundItemArray, setfoundItemArray] = React.useState([
        new Item(1, 1.3915, 103.8894, img1, "null",  "A", "red", "Circle", "blue", ""),
        new Item(0, 1.3542, 103.8838, img2, "null",  "A", "blue", "Square", "red", ""),
        new Item(0, 1.3485, 103.6357, img3, "null",  "B", "green", "Triangle", "yellow", ""),
        new Item(0, 1.3467, 103.9326, img4, "null",  "C", "yellow", "Circle", "green", ""),
        new Item(5, 1.3581, 103.9326, img5, "null",  "D", "purple", "Square", "purple", ""),

        new Item(0, 1.3467, 103.9326, img1, "null",  "B", "red", "Circle", "blue", ""),
        new Item(2, 1.3467, 103.9326, img2, "null",  "B", "blue", "Square", "red", ""),
        new Item(0, 1.3467, 103.9326, img3, "null",  "A", "green", "Triangle", "yellow", ""),
        new Item(0, 1.3467, 103.9326, img4, "null",  "C", "yellow", "Circle", "green", ""),
        new Item(0, 1.3467, 103.9326, img5, "null",  "E", "purple", "Square", "purple", ""),

        new Item(0, 1.3467, 103.9326, img1, "null",  "E", "red", "Circle", "blue", ""),
        new Item(0, 1.3467, 103.9326, img2, "null",  "D", "blue", "Square", "red", ""),
        new Item(3, 1.3467, 103.9326, img3, "null",  "C", "green", "Triangle", "yellow", ""),
        new Item(0, 1.3467, 103.9326, img4, "null",  "B", "yellow", "Circle", "green", ""),
        new Item(0, 1.3467, 103.9326, img5, "null",  "A", "purple", "Square", "purple", ""),

        new Item(0, 1.3467, 103.9326, img1, "null",  "E", "red", "Circle", "blue", ""),
        new Item(0, 1.3467, 103.9326, img2, "null",  "D", "blue", "Square", "red", ""),
        new Item(0, 1.3467, 103.9326, img3, "null",  "B", "green", "Triangle", "yellow", ""),
        new Item(4, 1.3467, 103.9326, img4, "null",  "D", "yellow", "Circle", "green", ""),
        new Item(0, 1.3467, 103.9326, img5, "null",  "A", "purple", "Square", "purple", "")
    ]);

    const [itemArray, setitemArray] = React.useState([itemA, itemB, itemC, itemD, itemE]);

    const updateItem = (index: number, newId: number) => {
        const newItems = foundItemArray.map((item, i) => {
            if (i === index) {
                return new Item(newId, item.lat, item.lng, item.image, item.bottleLetter, item.alphanumeric, item.alphanumericColor, item.shape, item.shapeColor, item.boxColor);
            } else if (item.id === newId) {
                return new Item(0, item.lat, item.lng, item.image, item.bottleLetter, item.alphanumeric, item.alphanumericColor, item.shape, item.shapeColor, item.boxColor);
            } else
                return item;
        });
        setfoundItemArray(newItems);
        setitemArray([itemA, itemB, itemC, itemD, itemE]);
      };

    const matchedItems = foundItemArray.filter(itemTwo => 
        itemArray.some(itemOne => itemOne.id === itemTwo.id)
    );
    
    const unmatchedItems = foundItemArray.filter(itemTwo => 
        !itemArray.some(itemOne => itemOne.id === itemTwo.id)
    );
    
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
                    {foundItemArray.map((item, i) => <Image key={i} item={item} foundItemIndex={foundItemArray.indexOf(item)} constItems={itemArray} updateItem={updateItem}/>)}
                </div>
                <div className="matched-gallery">
                    {itemArray.map((item, i) => <Image key={i} item={item} foundItemIndex={0} constItems={itemArray} updateItem={updateItem}/>)}
                </div>
            </div>
            <TuasMap className={'report-page-map'} lat={1.3467} lng={103.9326} matchedArray={matchedArray} unmatchedArray={unmatchedArray} matchedIcons={matchedIcons} unmatchedIcons={unmatchedIcons}/>
        </div>
    </main>
  )
}

export default Report;