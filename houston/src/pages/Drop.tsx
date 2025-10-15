import { ChangeEvent, useState } from "react";
import { AirdropType, AirdropSwap } from "../protos/obc.pb";
// import video from "../assets/IAMTHEANGRYPUMPKIN.mp4"

/**
 * Page that lets the user perform a manual drop
 * @returns manual drop page
 */
function Drop() {
  const [airdrop, setAirdrop] = useState<AirdropType>(AirdropType.Undefined);
  // const [playing, setPlaying] = useState<boolean>(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    switch (value) {
      case "1":
        setAirdrop(AirdropType.Water);
        break;
      case "2":
        setAirdrop(AirdropType.Beacon);
        break;
    }
  };

  /**
   * Sends a signal to GCS -> OBC to do manual airdrop based on the input bottle index
   */
  function handleDropClick() {
    const body = {
      index: airdrop,
    } as AirdropSwap;

    const video = document.getElementById("pumpkin") as HTMLVideoElement;
    video.play();
    // setPlaying(true);

    fetch("/api/plane/dodropnow", {
      method: "POST",
      body: JSON.stringify(body),
    })
      .then((resp) => resp.text())
      .then((resp) => {
        console.log(resp);
        video.play();
        // setPlaying(true);
      });
  }

  return (
    <>
      <h1>super secret manual airdrop button</h1>
      <form>
        <input type="number" onChange={handleChange} value={airdrop} />
        <input type="button" value={`Drop Bottle ${airdrop}`} onClick={handleDropClick} />
      </form>
      {/* <video src={video} id="pumpkin" style={{display: (!playing) ? "none" : ""}}></video> */}
    </>
  );
}

export default Drop;
