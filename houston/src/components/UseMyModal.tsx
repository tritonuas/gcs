import { useState } from "react";

/**
 * Returns function to open and close modal.
 * @returns ModalVisible, the boolean to represent the state of modal.
 * OpenModal. The function to turn the state of modalVisible to true.
 * CloseModal. The function to turn the state of modalVisible to false.
 */
export function useMyModal() {
  const [modalVisible, setModalVisible] = useState(false);

  const openModal = () => {
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  return { modalVisible, openModal, closeModal };
}
