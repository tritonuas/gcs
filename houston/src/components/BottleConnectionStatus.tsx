import "./BottleConnectionStatus.css"

import MyModal from "./MyModal";
import { OBCConnInfo } from '../protos/obc.pb';
import { useEffect, useState } from "react";

import coca from "../assets/coca.png";
import sunglass_emoji from "../assets/sunglass_emoji.jpg"

interface props {
    modalVisible: boolean;
    closeModal: () => void;
}

/**
 * A modal that displays coca-cola icons to represent disconnected bottles, along
 * with different background colors to represent the severity.
 * @param props - The properties of BottleConnectionStatus.
 * @param props.modalVisible - A boolean that dictates the visibility of the BottleConnectionStatus.
 * @param props.closeModal - A void function to close the BottleConnectionStatus.
 * @returns The BottleConnectionStatus modal.
 */
function BottleConnectionStatus({modalVisible, closeModal}:props) {
    const [obcStatus, setOBCStatus] = useState<OBCConnInfo>(JSON.parse(localStorage.getItem("obc_conn_status") || "{}") as OBCConnInfo);
    const [modalType, setModalType] = useState('default')
    const [droppedBottles, setDroppedBottles] = useState(0)

    /**
     * Note: the way protobuf serialization works is that if things are null values (false, 0.0) then they
     * wont show up in the serialization, as that can be "implied" to be a zero value by it not being there.
     * (At least this is my understanding). Therefore, if some of the expected values in the struct aren't there
     * it is because they are false/0.0 or some other 0-like value.
     */

    useEffect(() => {
        setInterval(() => {
            const data = localStorage.getItem("obc_conn_status") || "{}";
            setOBCStatus(JSON.parse(data));
        }, 1000);
    }, []);

    useEffect(() => {
        ('droppedBottleIdx' in obcStatus)
        ? 
        setDroppedBottles(obcStatus.droppedBottleIdx.length)
        :
        setDroppedBottles(0);
        
        switch(droppedBottles) {
            case 1:
            case 2:
            case 3:
            case 4:
                setModalType('warning');
                break;
            case 5:
                setModalType('error');
                break;
            default:
                setModalType('dafault');
                break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[obcStatus])
    
    return (
        <MyModal modalVisible={modalVisible} closeModal={closeModal} type={modalType}>
            <div>
                <div className="bottle_connection_status_title">
                    {droppedBottles==0 
                    ?    
                    'All bottles online'
                    :
                    'Bottles that have lost connection'
                    }
                </div>
                {droppedBottles==0 ? <img src={sunglass_emoji} alt="Sunglasses Emoji" width={'368px'} height={'270px'}/> : null}
                <ol className="flex-container">
                    { 
                        ('droppedBottleIdx' in obcStatus) 
                        ?
                        obcStatus.droppedBottleIdx.map((bottle, index) => {
                            return (
                                <div key={index} >
                                    <img
                                        src={coca}
                                        alt="coca-cola can"
                                        style={{ width: "30px", height: "50px", display: "inline-block"}} 
                                    />
                                    <div className="bottle_connection_status_bottle_number">{bottle}</div>
                                </div>
                            )
                        })
                        :
                        null
                    }
                </ol>
            </div>
        </MyModal>
    )
}
export default BottleConnectionStatus