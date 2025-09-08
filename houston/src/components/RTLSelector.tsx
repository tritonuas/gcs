import { useState } from "react";
import MyModal from "./MyModal";
import { useMyModal } from "./UseMyModal";

import "./RTLSelector.css";

interface props {
  modalVisible: boolean;
  closeModal: () => void;
}

/**
 * A modal for RTL (Return to Launch) confirmation. When confirmed,
 * sends signal to OBC to initiate RTL via MAVLink.
 * @param props - The properties of RTLSelector
 * @param props.modalVisible - A Boolean that dictates the visibility of the RTLSelector
 * @param props.closeModal - A void function to close the RTLSelector.
 * @returns A modal with RTL confirmation.
 */
function RTLSelector({ modalVisible, closeModal }: props) {
  const {
    modalVisible: fetchModalVisible,
    openModal: fetchOpenModal,
    closeModal: fetchCloseModal,
  } = useMyModal();
  const [fetchStatus, setFetchStatus] = useState("");
  const [fetchLog, setFetchLog] = useState("default");
  const [isLoadingFetch, setIsLoadingFetch] = useState(true);

  const [confirmInput, setConfirmInput] = useState("");

  const {
    modalVisible: confirmModalVisible,
    openModal: openConfirmModal,
    closeModal: closeConfirmModal,
  } = useMyModal();

  /**
   * Helper function that sends a post request to OBC
   * to initiate RTL and opens a modal to display
   * the response.
   */
  function submitRTL() {
    setIsLoadingFetch(true);
    fetchOpenModal();

    fetch(`/api/rtl`, { method: "POST" })
      .then(async (resp) => {
        if (resp.status == 200) {
          setFetchStatus("default");
          setFetchLog(await resp.text());
          setIsLoadingFetch(false);
        } else {
          setFetchStatus("error");
          setFetchLog(await resp.text());
          setIsLoadingFetch(false);
        }
      })
      .catch((err) => {
        console.error(err);
        setFetchStatus("error");
        setFetchLog(err);
        setIsLoadingFetch(false);
      });
  }

  return (
    <MyModal modalVisible={modalVisible} closeModal={closeModal}>
      <div className="rtl_button_outer_div">
        <h2>Return to Launch (RTL)</h2>
        <p>This will instruct the aircraft to return to its launch position.</p>
        <button
          className="rtl_button_submit_button"
          onClick={() => {
            openConfirmModal();
          }}
        >
          Initiate RTL
        </button>
      </div>
      <MyModal modalVisible={confirmModalVisible} closeModal={closeConfirmModal}>
        <h1>⚠️ WARNING ⚠️</h1>
        <p>You are about to initiate Return to Launch (RTL).</p>
        <p>
          CONFIRM that you want the aircraft to return to its launch position. This will override
          any current mission or flight plan.
        </p>
        <p>Type &quot;CONFIRM RTL&quot; into the text box to initiate the return to launch.</p>
        <input
          type="text"
          onChange={(txt) => setConfirmInput(txt.target.value)}
          value={confirmInput}
        />
        <button
          className="rtl_button_submit_button"
          onClick={() => {
            if (confirmInput === "CONFIRM RTL") {
              submitRTL();
            }
          }}
        >
          RTL
        </button>
      </MyModal>
      <MyModal
        modalVisible={fetchModalVisible}
        closeModal={fetchCloseModal}
        type={fetchStatus}
        loading={isLoadingFetch}
      >
        {fetchLog}
      </MyModal>
    </MyModal>
  );
}

export default RTLSelector;
