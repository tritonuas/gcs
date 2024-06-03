import "./MyModal.css"
import { Box, Button, Modal, Typography} from "@mui/material";
import { ReactNode } from "react";
import exit from "../assets/close.svg";

interface Props {
    children?: ReactNode;
    modalVisible: boolean;
    closeModal: () => void;
    type?:string;
    loading?:boolean;
}

/**
 * Selects background color given a string.
 * @param type The description of the type of modal.
 * @returns The hex code of the background color.
 */
function backgroundColorPicker(type:string){
    switch(type) {
        case 'error':
            return '#AC3344';
        case 'warning':
            return '#FFBF00';
        default:
            return '#2C6CFB';
    }
} 

/**
 * A modal component that comes with background color and an exit button.
 * @param props - The properties of the MyModal component.
 * @param props.children - React components to be embedded inside MyModal.
 * @param props.modalVisible - Boolean value to represent the status of the modal component.
 * @param props.closeModal - Function to close the modal.
 * @param props.type - If provided, a string value representing the type of modal, e.g., "default", "error"...
 * @param props.loading - If provided, a boolean value. If set to true, will display a loading circle animation.
 * @returns MyModal component.
 */
function MyModal({children, modalVisible, closeModal, type="default", loading=false}: Props){
       
    const backgroundColor = backgroundColorPicker(type);
    
    const style = {
        position: 'absolute' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        minWidth: 400,
        maxWidth: '100%',
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
        disableEscapeKeyDown={loading}
        >
            <Box sx={style}>
                <Button onClick={closeModal} disabled={loading}>
                    <img src={exit} />
                </Button>
                <Typography id="modal-modal-title" variant="h6" component="h2" textAlign={"center"}>
                    {loading ? <div className="lds-dual-ring"></div> : children}
                </Typography> 
            </Box>
        </Modal>
    )
}

export default MyModal;
