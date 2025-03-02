import React from "react"
import TuasMap from '../components/TuasMap.tsx'
import { Marker, Popup } from "react-leaflet";
import "./Report.css"
import L from 'leaflet';
import Button from '@mui/material-next/Button';
import { red, blue, green, yellow, purple, grey } from '@mui/material/colors';
import { post_targets, pull_targets } from "../utilities/pull_targets.ts";
import { MatchedTarget, IdentifiedTarget, Bottle, GPSCoord, oDLCObjectsToJSON, BottleDropIndex, ODLCObjects } from '../protos/obc.pb';

type UpdateItemFunction = () => void;

interface ImageProps {
    item: IdentifiedTarget;
    matchedItems: MatchedTarget[];
    foundItemIndex: number;
    updateMatched: UpdateItemFunction;
}

interface BottleProps {
    item: Bottle;
    matchedItems: MatchedTarget[];
}

const button_colors = [red[300], blue[300], green[500], yellow[700], purple[300]];

/**
 * @param props props
 * @param props.item image to be displayed
 * @param props.matchedItems array of items that we are comparing against
<<<<<<< HEAD
 * param props.updateMatched function to update matched item
=======
<<<<<<< HEAD
<<<<<<< HEAD
 * param props.updateMatched function to update matched items
=======
 * param props.updateMatched function to update matched item
>>>>>>> e72a5ee (mapping bound prototype)
=======
 * param props.updateMatched function to update matched items
>>>>>>> origin/feat/135-targetrename
>>>>>>> feat/merge/140/142-143
 * @returns image container
 */
function Image({item, matchedItems}: ImageProps) {
    /**
     * @returns reassigns the target to a different bottle
     */
    async function reassignHandler() {
        const value = prompt('Enter new Bottle ID');
        let bottleIndex = "null";
        if (value !== null) {
            bottleIndex = value;
        }

        // not using protobuf cause that shit is NOT working...
        const json: { [key: string]: typeof item.id } = {};
        json[`${bottleIndex}`] = item.id;

        const res = await post_targets(json);
        if (res) {
            alert("worked: refresh to update");
        } else {
            alert("didnt work");
        }
    }

    const match = matchedItems.find((itemX) => itemX.Target?.id === item.id);
    const matchIndex = matchedItems.findIndex((itemX) => itemX.Target?.id === item.id);

    let backgroundColor = {backgroundColor: "grey"};
    if (match) {
        backgroundColor = {backgroundColor: button_colors[matchIndex]};
    }
    return match ? (
        <div className="image-container" style={backgroundColor}>
            <img src={`data:image/png;base64,${item.Picture}`} alt="target" className="image" />
            <p className="image-data-lat-long">[{item.coordinate?.Latitude}, {item.coordinate?.Longitude}]</p>
            <p className="image-data"><b>Object:</b> {oDLCObjectsToJSON(item.Object)}</p>
            <Button 
                className='button' 
                size="small" 
                variant="filledTonal" 
                sx={{ backgroundColor: button_colors[matchIndex]}} 
                onClick={reassignHandler}>
                Reassign
            </Button> 
        </div>
    )
    : 
        <div className="image-container">
            <img src={`data:image/png;base64,${item.Picture}`} alt="target" className="image" />
            <p className="image-data-lat-long">[{item.coordinate?.Latitude}, {item.coordinate?.Longitude}]</p>
            <p className="image-data"><b>Objects:</b> {oDLCObjectsToJSON(item.Object)} </p>
            <Button 
                className='button' 
                size="small" 
                variant="filledTonal"
                sx={{ backgroundColor: grey[500]}}
                onClick={reassignHandler}>
                Reassign
            </Button> 
        </div>
}

/**
 * @param props props
 * @param props.item bottle to be displayed
 * @param props.matchedItems array of items that we are comparing against
 * @returns bottle container
 */
function BottleImage({item, matchedItems} : BottleProps) {
    const matchIndex = matchedItems.findIndex((itemX) => itemX.Bottle ? itemX.Bottle.Index === item.Index : null);
    let backgroundColor = {backgroundColor: "grey"};
    if (matchIndex !== -1) {
        backgroundColor = {backgroundColor: button_colors[matchIndex]};
    }
    return (
        <div className="image-container" style={backgroundColor}>
            <p className="image-data"><b>Bottle Letter:</b> {item.Index}</p>
            {/* not using function to parse item.Index cause that is being passed down as a string not the bespoke enum */}
            <p className="image-data"><b>Object:</b> {oDLCObjectsToJSON(item.Object)} </p>
            <p className="image-data"><b>Target ID:</b> {matchedItems[matchIndex].Target?.id}</p>
        </div>
    )

}

const dummyItem : IdentifiedTarget = {
    id : 0,
    Picture: "test.jpg",
    coordinate: GPSCoord.fromJSON({
        Latitude:  1.3915,
        Longitude: 103.8894,
        Altitude:  0,
    }),
    Object: ODLCObjects.Mattress,
};

const dummyItem1: MatchedTarget = {
    Bottle: Bottle.fromJSON({
        Index: BottleDropIndex.A,
        Object: ODLCObjects.Airplane,
    }),
    Target: dummyItem,
};


/**
 * @returns report page
 */
function Report() {
    const [foundItemArray, setfoundItemArray] = React.useState([dummyItem]);
    const [itemArray, setItemArray] = React.useState([dummyItem1]);
    React.useEffect(() => {
        pull_targets(setfoundItemArray, setItemArray);
    }, []);
    
    const [matched, setMatched] = React.useState(true);
    const [unmatched, setUnmatched] = React.useState(true);

    const matchedStyle = matched ? {backgroundColor: "var(--highlight)"} : {backgroundColor: "#808080", boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.75) inset"};
    const unmatchedStyle = unmatched ? {backgroundColor: "var(--highlight)"} : {backgroundColor: "#808080", boxShadow: "0 0 10px 0 rgba(0, 0, 0, 0.75) inset"};

    const handleMatched = () => {
        setMatched(prevMatched => !prevMatched);
        console.log("matched", matched);
    }
    
    const handleUnmatched = () => {
        setUnmatched(prevUnmatched => !prevUnmatched);
        console.log("unmatched", unmatched);
    }

    const matchedIcons = matched ? itemArray.map(item =>
        L.icon({
            iconUrl: `data:image/png;base64,${item.Target!.Picture}`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        })
    ) : [];

    const matchedArray = matched ? itemArray : [];
    const unmatchedArray = unmatched ? foundItemArray.filter(item => (!(itemArray.find(matchedItem => matchedItem.Target?.id === item.id)))
    ) : [];

    const unmatchedIcons = unmatched ? unmatchedArray.map(item =>
        L.icon({
            iconUrl: `data:image/png;base64,${item.Picture}`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        })
    ) : [];

    const updateMatched = () => {
        pull_targets(setfoundItemArray, setItemArray);
        setItemArray([...itemArray]);
        setfoundItemArray([...foundItemArray]);
    }

    const lat = 38.31442311312976;
    const lng = -76.54522971451763;
  return (
    <main className="report-page">
        <div className="button-container">
            <button onClick={() => {
                fetch('/api/targets/validate', {
                    method: "POST"
                })
                    .then(() => alert("good"))
                    .catch(() => alert("bad"))
            }}>Validate</button>
            <button onClick={() => {
                fetch('/api/targets/reject', {
                    method: "POST"
                })
                    .then(() => alert("good"))
                    .catch(() => alert("bad"))
            }}>Reject</button>
        </div>
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
                    {foundItemArray.map((item, i) => <Image key={i} item={item} matchedItems={itemArray} foundItemIndex={foundItemArray.indexOf(item)} updateMatched={updateMatched}/>)}
                </div>
                <div className="matched-gallery">
                    {itemArray.map((item, i) => item.Bottle ? <BottleImage key={i} item={item.Bottle} matchedItems={itemArray}/> : null)}
                </div>
            </div>
            <TuasMap className={'report-page-map'} lat={lat} lng={lng}>
                {matchedArray.map((marker) => (
                    <Marker key={marker.Target!.id} position={[marker.Target!.coordinate?.Latitude || lat, marker.Target!.coordinate?.Longitude || lng]} icon={matchedIcons[matchedArray.indexOf(marker)]}>
                        <Popup> {oDLCObjectsToJSON(marker.Target!.Object)}</Popup>
                    </Marker>
                ))}
                {unmatchedArray.map((marker) => (
                    <Marker key={marker.id} position={[marker.coordinate?.Latitude || lat, marker.coordinate?.Longitude || lng]} icon={unmatchedIcons[unmatchedArray.indexOf(marker)]}>
                        <Popup>{oDLCObjectsToJSON(marker.Object)}</Popup>
                    </Marker>
                ))}
            </TuasMap>
        </div>
    </main>
  )
}

export default Report;