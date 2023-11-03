import {useState, useEffect, } from 'react'
import type {JSX} from 'react'
import Modal from 'react-modal'
Modal.setAppElement("#root");

/**
 * Component that opens a popup upon being loaded in, with the option to disable the
 * popup in session storage.
 * @param props Props
 * @param props.storageKey Key to index into session storage to remember modal preferences
 * @param props.contentLabel Label to pass into the ReactModal
 * @param props.children Children elements in the DOM, which will be rendered inside.
 * @returns PageOpenPopup component
 */
export function PageOpenPopup(
    {storageKey, contentLabel, children}
    :{storageKey: string, contentLabel: string, children: JSX.Element | JSX.Element[] | never[]}
) {
    const [isOpen, setOpen] = useState(false);
    const [checkbox, setCheckbox] = useState(false);

    const STORAGE_IGNORE = 'ignore';
    const customStyles = {
        content: {
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            marginRight: '-50%',
            transform: 'translate(-50%, -50%)',
        },
    };
    
    useEffect(() => {
        // run once on component mount
        const preference = sessionStorage.getItem(storageKey);
        if (preference !== STORAGE_IGNORE) {
            setOpen(true)
        }

    }, [storageKey]);

    return (
        <>
            <Modal
                isOpen={isOpen} 
                onRequestClose={() => setOpen(false)}
                contentLabel={contentLabel}
                style={customStyles}
                >
                {children} 
                <label>
                    {"Don't show again:"}
                    <input type="checkbox" checked={checkbox} onChange={() => {
                        if (checkbox) {
                            // currently ignore, setting not ignore 
                            sessionStorage.removeItem(storageKey)
                        } else {
                            // currently not ignore, setting ignore
                            sessionStorage.setItem(storageKey, STORAGE_IGNORE);
                        }
                        setCheckbox(!checkbox);
                    }}></input>
                </label>
            </Modal>
        </>
    )
}