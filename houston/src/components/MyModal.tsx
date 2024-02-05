import "./MyModal.css"
import exit from "../assets/close.svg";
import { Box, Button, Modal, Typography} from "@mui/material";
import { ReactNode } from "react";

interface Props {
    children?: ReactNode;
    modalVisible: boolean;
    closeModal: () => void;
    type?:string;
    disable?:boolean;
}

/**
 * Selects background color given a string.
 * @param {String} type The description of the type of modal.
 * @returns {string} The hex code of the background color.
 */
function backgroundColorPicker(type:string){
    switch(type) {
        case 'error':
          return '#AC3344';
        default:
          return '#2C6CFB';
    }
} 


/**
 * A modal component that comes with background color and an exit button.
 * @param children react components to be embedded inside MyModal.
 * @param modalVisible boolean value to represent the satus of the modal component.
 * @param closeModal function tp close the modal.
 * @param type if provided, a string value representing the type of modal, ex: "deauflt", "error"...
 * @param disable if provide, boolean value if set to true, will dispaly a loading circle animation. 
 * @returns MyModal component.
 */
function MyModal({children, modalVisible, closeModal, type="default", disable=false}: Props){
       
    let backgroundColor = backgroundColorPicker(type);
    
    const style = {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: backgroundColor,
        border: '2px solid #000',
        borderRadius: "7px",
        boxShadow: 24,
        p: 2,
        justifyContent: "space-between",
    };
    
    return (
        <Modal 
        open={modalVisible} 
        onClose={closeModal} 
        aria-labelledby="modal-modal-title" 
        aria-describedby="modal-modal-description"
        disableEscapeKeyDown={disable}
        >
            <Box sx={style}>
                <Button onClick={closeModal} disabled={disable}>
                    <img src={exit} />
                </Button>
                <Typography id="modal-modal-title" variant="h6" component="h2" textAlign={"center"}>
                    {disable ? <div className="lds-dual-ring"></div> : null}
                </Typography> 
                {children}
            </Box>
        </Modal>
    )
}


export default MyModal;
