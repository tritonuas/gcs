import React from "react"
import TuasMap from '../components/TuasMap.tsx'
import "./Report.css"
import img1 from '../assets/report-page-images/amogus-1.png'
import img2 from '../assets/report-page-images/amogus-2.png'
import img3 from '../assets/report-page-images/amogus-3.png'
import img4 from '../assets/report-page-images/amogus-4.png'
import img5 from '../assets/report-page-images/amogus-5.png'

interface ImageProps {
    item: typeof item1;
}

/**
 * @param props props
 * @param props.item image to be displayed
 * @returns image container
 */
function Image({item}: ImageProps) {
    return (
        <div className="image-container">
            <img className="image" src={item.image} alt={"sus"} />
            <p className="image-data">Latitude {item.lat}</p>
            <p className="image-data">Longitude {item.lng}</p>
            <p className="image-data">Alphanumeric: {item.alphanumericColor} {item.alphanumeric}</p>
            <p className="image-data">Shape: {item.shapeColor} {item.shape}</p>
        </div>
    )
}

class Item {
    id: number;
    lat: number;
    lng: number;
    image: string;
    alphanumeric: string;
    alphanumericColor: string;
    shape: string;
    shapeColor: string;

    constructor(id: number, lat: number, lng: number, image: string, alphanumeric: string, alphanumericColor: string, shape: string, shapeColor: string) {
        this.id = id;
        this.lat = lat;
        this.lng = lng;
        this.image = image;
        this.alphanumeric = alphanumeric;
        this.alphanumericColor = alphanumericColor;
        this.shape = shape;
        this.shapeColor = shapeColor;
    }
}

const item1 = new Item(1, 1.3467, 103.9326, img1, "A", "red", "Circle", "blue");
const item2 = new Item(2, 1.3467, 103.9326, img2, "B", "blue", "Square", "red");
const item3 = new Item(3, 1.3467, 103.9326, img3, "C", "green", "Triangle", "yellow");
const item4 = new Item(4, 1.3467, 103.9326, img4, "D", "yellow", "Circle", "green");
const item5 = new Item(5, 1.3467, 103.9326, img5, "E", "purple", "Square", "purple");

/**
 * @returns report page
 */
function Report() {
  return (
    <main className="report-page">
        <div className="gallery-container">
            <div className="unmatched-gallery">
                <Image item={item1}/>
                <Image item={item2}/>
                <Image item={item3}/>
                <Image item={item4}/>
                <Image item={item5}/>

                <Image item={item1}/>
                <Image item={item2}/>
                <Image item={item3}/>
                <Image item={item4}/>
                <Image item={item5}/>

                <Image item={item1}/>
                <Image item={item2}/>
                <Image item={item3}/>
                <Image item={item4}/>
                <Image item={item5}/>
            </div>
            <div className="matched-gallery">
                <Image item={item1}/>
                <Image item={item2}/>
                <Image item={item3}/>
                <Image item={item4}/>
                <Image item={item5}/>
            </div>
        </div>
        <TuasMap className={'report-page-map'} lat={1.3467} lng={103.9326}/>
    </main>
  )
}

export default Report;