import React from "react"
import TuasMap from '../components/TuasMap.tsx'
import "./Report.css"
// import img1 from '../assets/report-page-images/amogus-1.png'
// import img2 from '../assets/report-page-images/amogus-2.png'
// import img3 from '../assets/report-page-images/amogus-3.png'
// import img4 from '../assets/report-page-images/amogus-4.png'
// import img5 from '../assets/report-page-images/amogus-5.png'
import L from 'leaflet';
import Button from '@mui/material-next/Button';
import { red, blue, green, yellow, purple, grey } from '@mui/material/colors';
import { pull_targets } from "../utilities/pull_targets.ts";
import { MatchedTarget, IdentifiedTarget, Bottle, ODLCColor, ODLCShape, GPSCoord, oDLCShapeToJSON, oDLCColorToJSON, BottleDropIndex } from '../protos/obc.pb';

// export type item = typeof itemA;

type UpdateItemFunction = (index: number, newId: number) => void;

interface ImageProps {
    item: IdentifiedTarget;
    matchedItems: MatchedTarget[];
    foundItemIndex: number;
    updateItem?: UpdateItemFunction;
}

const button_colors = [red[300], blue[300], green[500], yellow[700], purple[300]];

/**
 * @param props props
 * @param props.item image to be displayed
 * @param props.matchedItems array of items that we are comparing against
 * @param props.foundItemIndex index of the item in the foundItemArray
 * @param props.updateItem function to update the item
 * @returns image container
 */
function Image({item, matchedItems}: ImageProps) {
    // const reassignHandler = () => {
    //     const value = prompt('Enter new Bottle ID');
    //     let id = item.coordinate?.Altitude;
    //     if (value !== null) {
    //         id = parseInt(value);
    //     }
    // }
    const [imageUrl, setImageUrl] = React.useState<string>('');

    React.useEffect(() => {
        // Decode the base64 string into a binary string
        const binaryString = atob(item.Picture);

        // Convert the binary string to an array of integers
        const binaryArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
        binaryArray[i] = binaryString.charCodeAt(i);
        }

        // Create a new Blob object from the array of integers
        const blob = new Blob([binaryArray], { type: 'image/jpeg' });

        // Create a URL for the Blob object
        const imageUrl = URL.createObjectURL(blob);

        // Set the image URL in the state
        setImageUrl(imageUrl);

        // Clean up function to revoke the object URL when the component unmounts
        return () => {
        URL.revokeObjectURL(imageUrl);
        };
    }, []);
    const matchedTargets : IdentifiedTarget[] = [];

    matchedItems.forEach((item) => {
        if (item.Target != null){
            matchedTargets.push(item.Target);
        }
    });

    const match = matchedTargets.find((itemX) => itemX.id === item.id);

    let backgroundColor = {backgroundColor: "grey"};
    if (match) {
        const matchedColor = oDLCColorToJSON(match.AlphanumericColor);
        backgroundColor = {backgroundColor: matchedColor};
    }
    const matchIndex = matchedTargets.findIndex((itemX) => itemX.coordinate?.Altitude === item.coordinate?.Altitude);
    return match ? (
        <div className="image-container" style={backgroundColor}>
            <img className="image" src={imageUrl} alt={"sus"} />
            <p className="image-data-lat-long">[{item.coordinate?.Latitude}, {item.coordinate?.Longitude}]</p>
            {item.Alphanumeric !== "null" ?<p className="image-data"><b>Bottle Letter:</b> {item.Alphanumeric}</p> : null}
            <p className="image-data"><b>Alphanumeric:</b> {oDLCColorToJSON(item.AlphanumericColor)} {item.Alphanumeric}</p>
            <p className="image-data"><b>Shape:</b> {oDLCColorToJSON(item.ShapeColor)} {oDLCShapeToJSON(item.Shape)}</p>
            {item.Alphanumeric == "null" ?
                <Button 
                    className='button' 
                    size="small" 
                    variant="filledTonal" 
                    sx={{ backgroundColor: button_colors[matchIndex]}} 
                    >
                    Reassign
                </Button> 
            : null}
        </div>
    )
    : 
        <div className="image-container">
            <img className="image" src={imageUrl} alt={"sus"} />
            <p className="image-data-lat-long">[{item.coordinate?.Latitude}, {item.coordinate?.Longitude}]</p>
            {item.Alphanumeric !== "null" ?<p className="image-data"><b>Bottle Letter:</b> {item.Alphanumeric}</p> : null}
            <p className="image-data"><b>Alphanumeric:</b> {oDLCColorToJSON(item.AlphanumericColor)} {item.Alphanumeric}</p>
            <p className="image-data"><b>Shape:</b> {oDLCColorToJSON(item.ShapeColor)} {oDLCShapeToJSON(item.Shape)}</p>
            {item.Alphanumeric == "null" ?
                <Button 
                    className='button' 
                    size="small" 
                    variant="filledTonal" 
                    sx={{ backgroundColor: grey[500]}}
                    >
                    Reassign
                </Button> 
            : null}
        </div>
}

const dummyItem : IdentifiedTarget = {
    id : 0,
    Picture: "test.jpg",
    coordinate: GPSCoord.fromJSON({
        Latitude:  1.3915,
        Longitude: 103.8894,
        Altitude:  0,
    }),
    AlphanumericColor: ODLCColor.Blue,
    Alphanumeric:      "A",
    Shape:             ODLCShape.Circle,
    ShapeColor:        ODLCColor.Red,
    IsMannikin:        false,
};

const dummyItem1: MatchedTarget = {
    Bottle: Bottle.fromJSON({
        Alphanumeric: "A",
        AlphanumericColor: ODLCColor.Blue,
        Shape: ODLCShape.Circle,
        ShapeColor: ODLCColor.Red,
        Index: BottleDropIndex.A,
        IsMannikin: false,
    }),
    Target: dummyItem,
};


/**
 * @returns report page
 */
function Report() {
    const [foundItemArray, setfoundItemArray] = React.useState([dummyItem]);
    const [itemArray, setItemArray] = React.useState([dummyItem1]);
    pull_targets(setfoundItemArray, setItemArray);

    const matchedItems = foundItemArray.filter(itemTwo => 
        itemArray.some(itemOne => itemOne.Target?.coordinate?.Altitude === itemTwo.coordinate?.Altitude)
    );
    
    const unmatchedItems = foundItemArray.filter(itemTwo => 
        !itemArray.some(itemOne => itemOne.Target?.coordinate?.Altitude === itemTwo.coordinate?.Altitude)
    );
    
    const [matched, setMatched] = React.useState(true);
    const [unmatched, setUnmatched] = React.useState(true);

    const matchedStyle = matched ? {backgroundColor: "var(--highlight)"} : {backgroundColor: "#808080", boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.75) inset"};
    const unmatchedStyle = unmatched ? {backgroundColor: "var(--highlight)"} : {backgroundColor: "#808080", boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.75) inset"};

    const matchedArray = matched ? matchedItems : [];
    const unmatchedArray = unmatched ? unmatchedItems : [];

    const matchedIcons = matched ? matchedArray.map(item =>
        L.icon({
            iconUrl: item.Picture,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        })
    ) : [];

    const unmatchedIcons = unmatched ? unmatchedArray.map(item =>
        L.icon({
            iconUrl: item.Picture,
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
                    {foundItemArray.map((item, i) => <Image key={i} item={item} matchedItems={itemArray} foundItemIndex={foundItemArray.indexOf(item)}/>)}
                </div>
                <div className="matched-gallery">
                    {itemArray.map((item, i) => item.Target != null ? <Image key={i} item={item.Target} matchedItems={itemArray} foundItemIndex={0}/> : null)}
                </div>
            </div>
            <TuasMap className={'report-page-map'} lat={1.3467} lng={103.9326} matchedIcons={matchedIcons} unmatchedIcons={unmatchedIcons}/>
        </div>
    </main>
  )
}

export default Report;