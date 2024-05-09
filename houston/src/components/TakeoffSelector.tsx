import { useState } from "react";
import MyModal from "./MyModal";

import "./TakeoffSelector.css"

interface props{
    modalVisible: boolean;
    closeModal: ( ) => void;
}

/**
 * A modal with two options. Manual Takeoff and Autonomous Takeoff. When selected,
 * sends signal to obc in order to pick the TakeoffTick or ActiveTakeoffTick.
 * @param props - The properties of TakeoffSelector
 * @param props.modalVisible - A Boolean that dictates the visibility of the TakeoffSelector
 * @param props.closeModal - A void function to close the PlanePicker.
 * @returns A modal with two options.
 */
function TakeoffSelector({modalVisible, closeModal}:props){

    const [selectedTakeoff, setSelectedTakeoff] = useState(0)

    return(
        <MyModal modalVisible={modalVisible} closeModal={closeModal} >
            <div className='emergency_button_outer_div'>
                <div 
                    onClick={() => setSelectedTakeoff(1)} 
                    className={`emergency_button_takeoff_option ${selectedTakeoff === 1 ? 'select' : ''}`}>
                    Manual Takeoff
                </div>
                <div 
                    onClick={() => setSelectedTakeoff(2)}
                    className=  {`emergency_button_takeoff_option ${selectedTakeoff === 2 ? 'select' : ''}`}>
                    Autonomous Takeoff
                </div>
                <button className='emergency_button_submit_button'>submit</button>
            </div>
        </MyModal>
    )
    
}

export default TakeoffSelector;

