import { useState } from "react";
import MyModal from "./MyModal";
import { useMyModal } from "./UseMyModal";

import "./TakeoffSelector.css";

interface props {
  modalVisible: boolean;
  closeModal: () => void;
}

/**
 * A modal with two options. Manual Takeoff and Autonomous Takeoff. When selected,
 * sends signal to obc in order to pick the TakeoffTick or ActiveTakeoffTick.
 * @param props - The properties of TakeoffSelector
 * @param props.modalVisible - A Boolean that dictates the visibility of the TakeoffSelector
 * @param props.closeModal - A void function to close the PlanePicker.
 * @returns A modal with two options.
 */
function TakeoffSelector({ modalVisible, closeModal }: props) {
  const {
    modalVisible: fetchModalVisible,
    openModal: fetchOpenModal,
    closeModal: fetchCloseModal,
  } = useMyModal();
  const [selectedTakeoff, setSelectedTakeoff] = useState(0);
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
   * Helper function that sends a post request to obc
   * to set the takeoff option and opens a modal to display
   * the response.
   * @param option - A string that specifies manual or autonomous.
   */
  function submitTakeoffOption(option: string) {
    setIsLoadingFetch(true);
    fetchOpenModal();

    fetch(`/api/takeoff/${option}`, { method: "POST" })
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
      <div className="emergency_button_outer_div">
        <div
          onClick={() => setSelectedTakeoff(1)}
          className={`emergency_button_takeoff_option ${selectedTakeoff === 1 ? "select" : ""}`}
        >
          Manual Takeoff
        </div>
        <div
          onClick={() => setSelectedTakeoff(2)}
          className={`emergency_button_takeoff_option ${selectedTakeoff === 2 ? "select" : ""}`}
        >
          Autonomous Takeoff
        </div>
        <button
          className="emergency_button_submit_button"
          onClick={() => {
            if (selectedTakeoff === 1) {
              submitTakeoffOption("manual");
            }
            if (selectedTakeoff === 2) {
              openConfirmModal();
            }
          }}
        >
          submit
        </button>
      </div>
      <MyModal modalVisible={confirmModalVisible} closeModal={closeConfirmModal}>
        <h1>⚠️ WARNING ⚠️</h1>
        <p>You are about to ARM the plane and initiate an autonomous takeoff.</p>
        <p>
          CONFIRM that all appropriate preflight checks have been performed, and that the plane is
          in a position from which it is safe to take off.
        </p>
        <p>
          Once you have done all of this, type &quot;ITS TUASING TIME&quot; into the text box to
          initiate the autonomous takeoff.
        </p>
        <input
          type="text"
          onChange={(txt) => setConfirmInput(txt.target.value)}
          value={confirmInput}
        />
        <button
          className="emergency_button_submit_button"
          onClick={() => {
            // check 3 times, for 3 times the resistance against cosmic bit flips
            if (confirmInput === "ITS TUASING TIME") {
              if (confirmInput === "ITS TUASING TIME") {
                if (confirmInput === "ITS TUASING TIME") {
                  submitTakeoffOption("autonomous");
                }
              }
            }
          }}
        >
          TAKEOFF
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

export default TakeoffSelector;
