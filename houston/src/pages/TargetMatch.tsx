import "./TargetMatch.css"

import ReactImageGallery from "react-image-gallery";
import { useState } from "react";
import { AirdropTarget, GPSCoord} from '../protos/obc.pb';

/**
 * @returns Returns manual target matching page.
 */
function TargetMatch() {
    /**
     * The bottles that exist.
     */
    const bottle_list = ['A', 'B', 'C', 'D', 'E'];

    /**
     * Define the initial state for lat_lng
     */
    const lat_lng_template = [
        { lat: '', lng: '', setLat: (value: number|string) => handleUpdate(0, 'lat', value), setLng: (value: number|string) => handleUpdate(0, 'lng', value) },
        { lat: '', lng: '', setLat: (value: number|string) => handleUpdate(1, 'lat', value), setLng: (value: number|string) => handleUpdate(1, 'lng', value) },
        { lat: '', lng: '', setLat: (value: number|string) => handleUpdate(2, 'lat', value), setLng: (value: number|string) => handleUpdate(2, 'lng', value) },
        { lat: '', lng: '', setLat: (value: number|string) => handleUpdate(3, 'lat', value), setLng: (value: number|string) => handleUpdate(3, 'lng', value) },
        { lat: '', lng: '', setLat: (value: number|string) => handleUpdate(4, 'lat', value), setLng: (value: number|string) => handleUpdate(4, 'lng', value) }
    ];
    
    /**
     * A state variable that is an array where each element is a json object that
     * contains the latitude, longitude, latitude setter, and longitude setter.
     * It has 5 json because there are five bottles.
     */
    const [lat_lng, set_lat_lng] = useState(lat_lng_template);

    /**
     * This function handels the set_lat_lng state setter. Since lat_lng
     * is an array, to change a specific value, we use this function to index
     * into it.
     * @param index The index that help you grab the specific json.
     * @param key   This either 'lat' or 'lng'.
     * @param value The number representing the latitude or longitude.
     */
    const handleUpdate = (index:number, key:string, value:number|string) => {
        set_lat_lng(pre_lat_lng => {
            const new_lat_lng = [...pre_lat_lng];
            new_lat_lng[index] = { ...new_lat_lng[index], [key]: value };
            return new_lat_lng;
        });
    };


    /**
     * This functions puts all the values in the lat_lng variable into an array
     * consisting of the struct AirdropTarget from obc.protos.
     * @param event A form tag event.
     * 
     * [
     *  {
     *      Index: BottleDropIndex,
     *      Coordiante: GPSCoord,
     *  },
     *  ...
     * ]
     */
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const airdrop_target_list: AirdropTarget[] = [];
        bottle_list.forEach((_, index: number) => {
            if(lat_lng[index].lat != '' && lat_lng[index].lng != '') {
                const coordiante: GPSCoord =  {
                    Latitude: parseInt(lat_lng[index].lat),
                    Longitude: parseInt(lat_lng[index].lng),
                    Altitude: 0,
                }
                const airdrop_target: AirdropTarget = {
                    Index: index+1,
                    Coordinate: coordiante,
                }
                airdrop_target_list.push(airdrop_target);
            }
            
        });
        set_lat_lng(lat_lng_template);
        console.log('Form Data:', airdrop_target_list);

        if(airdrop_target_list.length > 0) {
            fetch("/api/airdrop", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(airdrop_target_list)
            })
                .then(response => {
                    if (response.status == 200) {
                        console.log(response.text());
                    } else {
                        console.log("ERROR: " + response.text());
                    }
                })
                .catch(err => {
                    console.log("ERROR: " + err);
                })
        }
    };

    const images = [
        {
            original: "https://picsum.photos/id/1018/1000/600/",
            thumbnail: "https://picsum.photos/id/1018/250/150/",
        },
        {
            original: "https://picsum.photos/id/1015/1000/600/",
            thumbnail: "https://picsum.photos/id/1015/250/150/",
        },
        {
            original: "https://picsum.photos/id/1019/1000/600/",
            thumbnail: "https://picsum.photos/id/1019/250/150/",
        },
    ];
   
    return (
        <div className="flex-box">
            <div className="left-box">
                <div className="form-container">
                    <form onSubmit={(e) => handleSubmit(e)} >
                        {
                            bottle_list.map((bottle, index) => {
                                return (
                                    <div className="bottle" key={index}>
                                        <h1>Bottle {bottle}</h1>
                                        <input className="input-field" type="number" placeholder="lat" value={lat_lng[index].lat} onChange={(e) => {
                                                const value = e.target.value;
                                                if (value.trim() === '') {
                                                    lat_lng[index].setLat('');
                                                } else {
                                                    const numericValue = parseInt(value);
                                                    if (!isNaN(numericValue)) {
                                                        lat_lng[index].setLat(numericValue);
                                                    }
                                                }
                                            }} />
                                        <input className="input-field" type="number" placeholder="lng" value={lat_lng[index].lng} onChange={(e) => {
                                             const value = e.target.value;
                                             if (value.trim() === '') {
                                                 lat_lng[index].setLng('');
                                             } else {
                                                 const numericValue = parseInt(value);
                                                 if (!isNaN(numericValue)) {
                                                     lat_lng[index].setLng(numericValue);
                                                 }
                                             }
                                            }} />
                                    </div>
                                )
                            })
                        }
                        <input className="submit-button" type="submit" value="Submit"></input>
                    </form>
                </div>
            </div>
            <div className="right-box">
                <ReactImageGallery items={images} showPlayButton={false}>

                </ReactImageGallery>
            </div>
        </div>
        
    )
}
export default TargetMatch;