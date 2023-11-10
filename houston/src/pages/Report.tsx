import React from "react"
import TuasMap from '../components/TuasMap.tsx'
import "./Report.css"

/**
 * @returns report page
 */
function Report() {
  return (
    <main className="report-page">
        <div className="gallery-container">
            <div className="unmatched-gallery">
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
            </div>
            <div className="matched-gallery">
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
                <div className="image"> 
                </div>
            </div>
        </div>
        <TuasMap className={'report-page-map'} lat={1.3467} lng={103.9326}/>
    </main>
  )
}

export default Report;