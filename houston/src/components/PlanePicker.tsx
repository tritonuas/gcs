import MyModal from "./MyModal";
import "./PlanePicker.css"

import yellowPlane from '../assets/yellowPlane.gif';
import duck from '../assets/duck.png';
import { useEffect, useState } from "react";

interface props{
    modalVisible: boolean;
    closeModal: ( ) => void;
    loading?: boolean;
}

/**
 * A modal with icons to let users choose from.
 * @param props - The properties of PlanePicker.
 * @param props.modalVisible - A boolean that dictates the visibility of the PlanePicker.
 * @param props.closeModal - A void function to close the PlanePicker.
 * @param props.loading - Optional indicator as to wether it should show a loading screen. 
 * @returns A modal that contains icons that can be selected.
 */
function PlanePicker({modalVisible, closeModal, loading=false}:props){

    const [icons] = useState([duck, yellowPlane]);

    const [highlightedItem, setHighlightedItem] = useState(() =>{
        const data = localStorage.getItem("index");
        return data ? data : 0;
    });

    const saveToLocalStorage = (key:string, value:string) => {
        localStorage.setItem(key, value);
    }

    const loadFromLocalStorage = (key:string) => {
        const data = localStorage.getItem(key);
        return data ? data : null;
    }

    const handleItemClick = (index:number) => {
        setHighlightedItem(index);
    };
    
    const handleSelect = (index:number, icon:string) => {
        saveToLocalStorage("index", String(index));
        saveToLocalStorage("icon", icon);
    }

    useEffect(() => {
        const index = loadFromLocalStorage("index");
        index ? setHighlightedItem(Number(index)) : setHighlightedItem(0);
    }, []);
    
    return(
        <MyModal modalVisible={modalVisible} closeModal={closeModal} loading={loading}>
           <ol className="flex-container">
                {icons.map((icon, index) => {
                    return (
                            <div 
                                key={index}
                                className={`flex-item ${highlightedItem === index ? 'highlight' : ''}`} 
                                onClick={() => handleItemClick(index)}
                                >
                                <img src={icon} width={"70px"} height={"70px"} onClick={() => handleSelect(index, icon)}></img>  
                            </div>
                    )
                })}
            </ol>
        </MyModal>   
    )
}

export default PlanePicker;