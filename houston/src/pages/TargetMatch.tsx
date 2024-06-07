import "./TargetMatch.css"

import ReactImageGallery from "react-image-gallery";
import { useState } from "react";

interface LatLng {
    lat: string;
    lng: string;
}
  
interface BottleData {
    [key: string]: LatLng;
}

/**
 * @returns Returns manual target matching page.
 */
function TargetMatch() {
    const bottle_list = ['A', 'B', 'C', 'D', 'E'];

    const [lat_lng, set_lat_lng] = useState([
        { lat: '', lng: '', setLat: (value:number) => handleUpdate(0, 'lat', value), setLng: (value:number) => handleUpdate(0, 'lng', value) },
        { lat: '', lng: '', setLat: (value:number) => handleUpdate(1, 'lat', value), setLng: (value:number) => handleUpdate(1, 'lng', value) },
        { lat: '', lng: '', setLat: (value:number) => handleUpdate(2, 'lat', value), setLng: (value:number) => handleUpdate(2, 'lng', value) },
        { lat: '', lng: '', setLat: (value:number) => handleUpdate(3, 'lat', value), setLng: (value:number) => handleUpdate(3, 'lng', value) },
        { lat: '', lng: '', setLat: (value:number) => handleUpdate(4, 'lat', value), setLng: (value:number) => handleUpdate(4, 'lng', value) }
    ]);

    const handleUpdate = (index:number, key:string, value:number) => {
        set_lat_lng(pre_lat_lng => {
        const new_lat_lng = [...pre_lat_lng];
        new_lat_lng[index] = { ...new_lat_lng[index], [key]: value };
        return new_lat_lng;
        });
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
   
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); 

        const bottle_data: BottleData = {};

        bottle_list.forEach((bottle:string, index: number) => {
            bottle_data[`bottle${bottle}`] =  {'lat': lat_lng[index].lat, 'lng': lat_lng[index].lng}
        });
                
        console.log('Form Data:', bottle_data);
    };

    return (
        <div className="flex-box">
            <div className="left-box">
                <div className="form-container">
                    <form onSubmit={handleSubmit} >
                        {
                            bottle_list.map((bottle, index) => {
                                return (
                                    <div className="bottle" key={index}>
                                        <h1>Bottle {bottle}</h1>
                                        <input className="input-field" type="number" placeholder="lat" value={lat_lng[index].lat} onChange={(e) => lat_lng[index].setLat(parseInt(e.target.value))} ></input>
                                        <input className="input-field" type="number" placeholder="lng" value={lat_lng[index].lng} onChange={(e) => lat_lng[index].setLng(parseInt(e.target.value))} ></input>
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