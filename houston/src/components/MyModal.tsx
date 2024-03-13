import "./MyModal.css"
import { Box, Modal, Typography} from "@mui/material";
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
 * @param type The description of the type of modal.
 * @returns The hex code of the background color.
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
 * @param props - The properties of the MyModal component.
 * @param props.children - React components to be embedded inside MyModal.
 * @param props.modalVisible - Boolean value to represent the status of the modal component.
 * @param props.closeModal - Function to close the modal.
 * @param props.type - If provided, a string value representing the type of modal, e.g., "default", "error"...
 * @param props.disable - If provided, a boolean value. If set to true, will display a loading circle animation.
 * @returns MyModal component.
 */
function MyModal({children, modalVisible, closeModal, type="default", disable=false}: Props){
       
    const backgroundColor = backgroundColorPicker(type);
    
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
                <Typography id="modal-modal-title" variant="h6" component="h2" textAlign={"center"}>
                    {disable ? <div className="lds-dual-ring"></div> : null}
                </Typography>
                {children}
            </Box>
        </Modal>
    )
}


export default MyModal;
