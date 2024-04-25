import { ChangeEvent, useState } from "react"
import { BottleDropIndex, BottleSwap } from "../protos/obc.pb";


/**
 * Page that lets the user perform a manual drop
 * @returns manual drop page
 */
function Drop() {
    const [bottle, setBottle] = useState<BottleDropIndex>(BottleDropIndex.A);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        switch (value) {
            case "1":
                setBottle(BottleDropIndex.A);
                break;
            case "2":
                setBottle(BottleDropIndex.B);
                break;
            case "3":
                setBottle(BottleDropIndex.C);
                break;
            case "4":
                setBottle(BottleDropIndex.D);
                break;
            case "5":
                setBottle(BottleDropIndex.E);
                break;
        }
    };

    /**
     * Sends a signal to GCS -> OBC to do manual airdrop based on the input bottle index
     */
    function handleDropClick() {
        const body = {
            index: bottle
        } as BottleSwap;
        
        fetch("/api/plane/dodropnow", {
            method: "POST",
            body: JSON.stringify(body)
        })
            .then(resp => resp.text())
            .then(resp => alert(resp))
    }

    return(
        <>
            <h1>super secret manual airdrop button</h1>
            <form>
                <input type="number" onChange={handleChange} value={bottle} />
                <input type="button" value={`Drop Bottle ${bottle}`} onClick={handleDropClick}/>
            </form>
        </>

    );
}

export default Drop;