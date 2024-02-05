import { useState } from "react";

/**
 * Returns function to open and close modal.
 * @returns {boolean} modalVisible, the boolean to represent the state of modal.
 * @returns openModal. The function to turn the state of modalVisible to true.
 * @returns closeModal. The function to turn the state of modalVisible to false.
 */
export function useModal() {
    const [modalVisible, setModalVisible] = useState(false);
  
    const openModal = () => {
      setModalVisible(true);
    };
  
    const closeModal = () => {
      setModalVisible(false);
    };
  
    return { modalVisible, openModal, closeModal };
}