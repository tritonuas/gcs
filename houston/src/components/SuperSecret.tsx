import { CSSProperties, MouseEvent, useState } from "react";
import "./SuperSecret.css";
import receipt from "../assets/receipt.svg"
import tuasMember from "../assets/tuas-member.svg"
import robot from "../assets/robot.svg"
import insideMan from "../assets/inside-man.svg"
import printer from "../assets/printer.svg"
import { roundDecimal, useInterval } from "../utilities/general";
import CountUp from "react-countup";
import sprite from "../assets/sprite.png"
import boba from "../assets/boba.png"

class StoreItem {
    imgSrc: string
    name: string
    description: string
    baseCost: number;
    clicksPerSecond: number;

    constructor(src: string, name: string, description: string, cost: number, clicksPerSecond: number) {
        this.imgSrc = src;
        this.name = name;
        this.description = description;
        this.baseCost = cost;
        this.clicksPerSecond = clicksPerSecond;
    }

    getCost(count: number) {
        return this.baseCost * ((10 + count) / 10);
    }
}

const ALL_STORE_ITEMS = [
    new StoreItem(tuasMember, "TUAS Member", "A TUAS member who will help by making additional orders.", 20, 0.1),
    new StoreItem(insideMan, "Tapex Employee", "A TUAS member who has gone undercover", 500, 5),
    new StoreItem(robot, "Robot", "A TUAS developed autonomous robot which will make additional orders", 2000, 25),
    new StoreItem(printer, "Printer", "A TUAS developed black-market Tapex receipt printer", 10000, 100),
];

export function SuperSecret() {
    const ICON_WIDTH = 64;

    const [started, setStarted] = useState(false);
    const [sillyIcons, setSillyIcons] = useState<[string, number][]>([]);
    const [receiptCount, setReceiptCount] = useState(0);
    const [prevReceiptCount, setPrevReceiptCount] = useState(0);
    const [inventory, setInventory] = useState<number[]>(ALL_STORE_ITEMS.map(_ => 0));
    const [currDescription, setCurrDescription] = useState(`Receipts per second ${calculateReceiptsPerSecond()}`);

    function calculateReceiptsPerSecond(): number {
        let increase = 0;
        inventory.forEach((currItemCount, currIndex) => {
            increase += currItemCount * ALL_STORE_ITEMS[currIndex].clicksPerSecond;
        });
        return increase;
    }

    function addItem(index: number) {
        setInventory(inventory.map((numCurrItem, currIndex) => {
            if (index == currIndex) {
                return numCurrItem + 1;
            } else {
                return numCurrItem;
            }
        }));
    }
    
    function generateRandomSillyIcon():[string, number] {
        const icon = (Math.random() < 0.5) ? sprite : boba;
        const xPos = Math.random() * window.innerWidth;
        return [icon, xPos];
    }

    function handleClick(_evt: MouseEvent<HTMLImageElement>) {
        if (!started) {
            setStarted(true);
        }

        setPrevReceiptCount(receiptCount);
        setReceiptCount(count => count + 1);
        
        setInventory(inventory.map(x => x));

        if (Math.random() < 0.005) {
            setSillyIcons(sillyIcons => sillyIcons.concat([generateRandomSillyIcon()]));
        }
    }

    useInterval(() => {
        setPrevReceiptCount(receiptCount);
        setReceiptCount(count => count + calculateReceiptsPerSecond());
    }, 1000);

    return (
        <div className={'map s-s'}>
            {
                (started) ?
                    <div className={'info-bar'}>
                        Tapex Receipts<br></br>
                        <CountUp
                            className="count"
                            start={roundDecimal(prevReceiptCount)}
                            end={roundDecimal(receiptCount)}
                            duration={0.8}
                            /> 
                    </div> 
                        :
                    <h1 className={'title'}>
                        TUAS Clicker
                    </h1>
            }

            <img 
                className={'svg white clickable'} 
                onClick={handleClick} 
                width={ICON_WIDTH} 
                height={ICON_WIDTH} 
                src={receipt}
                />

            {
                (started) ?
                    <div className={'inventory'}>
                        {inventory.map((numCurrItem, index) => {
                            const item = ALL_STORE_ITEMS[index];
                            const cost = item.getCost(numCurrItem);
                            const costStyle: CSSProperties = {
                                color: (receiptCount < cost) ? "var(--failure-text)" : "var(--success-text)",
                            }
                            return (
                                <div 
                                    className="inventory-item" 
                                    key={"_" + receiptCount + "_" + index + "_" + numCurrItem}
                                    onClick={() => {
                                        if (receiptCount >= cost) {
                                            setPrevReceiptCount(receiptCount);
                                            setReceiptCount(count => count - cost);
                                            addItem(index);
                                        }
                                    }} 
                                    >
                                    <img 
                                        src={item.imgSrc} 
                                        width={ICON_WIDTH} 
                                        height={ICON_WIDTH} 
                                        className={'svg white clickable'}
                                        onMouseEnter={() => {
                                            setCurrDescription(item.description);
                                        }}
                                        onMouseLeave={() => {
                                            setCurrDescription(`Receipts per second: ${roundDecimal(calculateReceiptsPerSecond())}`);
                                        }}
                                        />
                                    <p>{item.name}</p>
                                    <p style={costStyle} >Cost: {cost}</p>
                                    <p>{numCurrItem}</p>
                                </div>

                            );
                        })}
                    </div>
                        :
                    <div>
                    </div>
            }
            {
                sillyIcons.map((src) =>
                    <img src={src[0]} 
                         style={{left: `${src[1]}px`}} 
                         height={ICON_WIDTH} 
                         className="silly-icon"
                         />
                )
            }
            <div className="description">
                {(started) ? currDescription : ""}
            </div>
        </div>
    );
}