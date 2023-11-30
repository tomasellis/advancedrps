import { ContractFactory, ethers } from "ethers";
import { arrayify, solidityKeccak256 } from "ethers/lib/utils";
import Peer from "peerjs";
import React, { useEffect, useState } from "react";
import { RPS, RPS__factory } from "../public/utils";
import initPeer from "../utils/initPeer";
import Timer from "./Timer";
import WeaponSelector from "./WeaponSelector";
import NonInteractableWeapon from "./NonInteractableWeapon";
import { copyPasteIcon, externalIcon } from "../utils/svgIcons";
import { nanoid } from "nanoid";
import { useInterval } from "../utils/useInterval";

const BASE_URL = process.env.NEXT_PUBLIC_BASEURL || "http://localhost:3000";

type PeerMsg =
  | { _type: "Winner", player: Winner }
  | { _type: "Player1Weapon", weapon: number }
  | { _type: "Player2Weapon", weapon: number }
  | { _type: "Connected" }
  | { _type: "Rematch", rematch: boolean }

type Winner = "P1" | "P2" | "no one, a draw" | "idle";

type TimerType = {
  status: "running" | "idle" | "finished";
  defaultTime: Date;
  expired: boolean;
  reset: boolean;
};

enum Weapon {
  Null,
  Rock,
  Paper,
  Scissor,
  Spock,
  Lizard
}

const strongMatchups: Record<Weapon, [Weapon, Weapon]> = {
  [Weapon.Null]: [Weapon.Null, Weapon.Null],
  [Weapon.Rock]: [Weapon.Lizard, Weapon.Scissor],
  [Weapon.Paper]: [Weapon.Rock, Weapon.Spock],
  [Weapon.Scissor]: [Weapon.Paper, Weapon.Lizard],
  [Weapon.Spock]: [Weapon.Scissor, Weapon.Rock],
  [Weapon.Lizard]: [Weapon.Paper, Weapon.Spock]
}

type ScreenToDisplay =
  | "WaitingForP2Connection"
  | "Player2Connected"
  | "Player2Decided"
  | "PlayerTimedout"
  | "EndScreen"

const Player1UI = () => {

  const [screenToDisplay, setScreenToDisplay] = useState<ScreenToDisplay>(
    "WaitingForP2Connection" // DEV: WaitingForP2Connectino
  );
  const [chosenWeapon, setChosenWeapon] = useState<number>(0)
  const [peerId, setPeerId] = useState<string>("");
  const [weapon, setWeapon] = useState<number>(0);
  const [connState, setConnState] = useState<Peer.DataConnection>();
  const [winner, setWinner] = useState<Winner>("idle");
  const [player2Weapon, setPlayer2Weapon] = useState<number>(0);
  const [rematch, setRematch] = useState<boolean>(false)
  const [rematchP2, setRematchP2] = useState<boolean>(false)
  const [timer, setTimer] = useState<TimerType>({
    status: "idle",
    defaultTime: new Date(),
    expired: false,
    reset: false,
  });

  const resetEverything = () => {
    setScreenToDisplay("Player2Connected")
    setWeapon(0)
    setChosenWeapon(0)
    setWinner("idle")
    setRematch(false)
    setRematchP2(false)
    setPlayer2Weapon(0)
  }

  const player2Timedout = async () => {
    setScreenToDisplay("PlayerTimedout");
    //@ts-ignore
    // Develop 
  };

  const sendWeaponChoice = (weapon: number) => {
    const msg: PeerMsg = {
      _type: "Player1Weapon",
      weapon: weapon
    }
    connState?.send(msg)

    setChosenWeapon(weapon)
    if (player2Weapon !== 0) {
      setScreenToDisplay("EndScreen")
      setWinner(computeWinner(weapon, player2Weapon))
    }
  }

  const sendRematch = () => {
    const msg: PeerMsg = {
      _type: "Rematch",
      rematch: true
    }
    connState?.send(msg)
    setRematch(true)
  }
  // Peer js setup, dinamically as to please NextJS
  useEffect(() => {
    console.log("Trying to reach PeerJS servers");
    const asyncFn = async () => {
      console.log("Trying to create Peer");
      const id = `advancedRPS-${nanoid()}`;
      const peer = await initPeer(id);

      // Save own peer id
      setTimeout(() => {
        setPeerId(peer.id);
      }, 1000)


      peer.on("open", () => console.log('OPEN'));

      peer.on("error", (e) => console.log("ERROR", e));

      peer.on("connection", (conn) => {
        conn.on("error", (e) => console.log("ConnERROR", e));

        conn.on("open", () => {
          conn.send("Linked with Peer 1!");
          const msg: PeerMsg = {
            _type: "Connected",
          };
          conn.send(msg);
        });

        // Save connection for future use
        setConnState(conn);

        // Set event listeners for Peer communication
        conn.on("data", (data: PeerMsg) => {
          switch (data._type) {
            case "Connected":
              return setScreenToDisplay("Player2Connected");
            case "Player2Weapon":
              console.info('Got P2 weapon', data.weapon)
              return setPlayer2Weapon(data.weapon)
            case "Rematch":
              return setRematchP2(true)
            default:
              return console.log("Default connection state");
          }
        });
      });
    };
    asyncFn();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (chosenWeapon === 0 && player2Weapon !== 0) {
      setScreenToDisplay("Player2Decided")
    }
    if (chosenWeapon !== 0 && player2Weapon !== 0) {
      setWinner(computeWinner(chosenWeapon, player2Weapon))
      setScreenToDisplay("EndScreen")
    }
  }, [player2Weapon, chosenWeapon])

  useEffect(() => {
    if (rematch && rematchP2) {
      resetEverything()
    }
  }, [rematch, rematchP2])

  switch (screenToDisplay) {
    default:
      return <div></div>;
    case "WaitingForP2Connection":
      return (
        <div
          className={"relative flex-1 flex flex-col flex-nowrap items-center"}
          style={{
            paddingTop: "4rem",
            color: "#FFFA83",
          }}
        >
          {/* This div displays status info */}
          <div
            className={"flex-1 flex flex-col w-full max-w-lg"}
            style={{ flexGrow: 0.5 }}
          >
            {peerId === "" ? (
              <span className={"text-4xl "}>Creating match 😎</span>
            ) : <span className={"text-4xl "}>Waiting for Player 2... 😴</span>}
            <br />
            {peerId === "" ? (
              <span className={"text-4xl "}>
                Pinging the P2P router. Hold on...
              </span>
            ) : (
              <div className="flex-1 flex justify-center items-center">
                <button
                  onClick={() =>
                    copyToClipBoard(`${BASE_URL}/?peerId=${peerId}&notWeb3=true`)
                  }
                  style={{
                    color: "#FFFA83",
                    backgroundColor: "#FF005C",
                    width: "fit-content",
                  }}
                  className="rounded-md text-xl flex flex-row px-4 py-3"
                >
                  <div style={{ width: "1.5rem", height: "1.5rem" }}>
                    {copyPasteIcon}
                  </div>
                  <span style={{ marginLeft: "5px" }}>
                    Click and share to connect with another player!
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      );
    case "Player2Connected":
      return (
        <div
          className={"relative flex-1 flex flex-col flex-nowrap items-center"}
          style={{
            paddingTop: "4rem",
            color: "#FFFA83",
          }}
        >
          {/* This div displays status info */}
          <div
            className={"flex-1 flex flex-col w-full max-w-lg"}
            style={{ flexGrow: chosenWeapon === 0 ? 0.5 : 0 }}
          >
            {chosenWeapon === 0 ?
              <>
                <span className={"text-4xl"}>
                  Linked with Player 2 🤝
                </span>
                <br />
                <span className={"text-4xl"}>
                  Choose your weapon 🤔
                </span>
                <br />
              </> : <>
                <span className={"text-4xl"}>
                  Weapon chosen ⚔️
                </span>
                <br />
                <span className={"text-4xl"}>
                  Waiting for Player 2... 😴
                </span>
                <br />
              </>
            }
          </div>

          {/* This div displays buttons */}
          {chosenWeapon === 0 ?
            <div
              className={"flex-1 flex flex-col w-full justify-center max-w-2xl"}
              style={{ flexGrow: 1 }}
            >
              <WeaponSelector setWeapon={setWeapon} initialWeapon={weapon} />
              <div className="flex-1 flex flex-col justify-center items-center" >
                {weapon !== 0 ? <button
                  onClick={() => {
                    sendWeaponChoice(weapon);
                  }}
                  style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                  className="w-96 h-14 rounded-md text-xl"
                >
                  Cement your choice 🗿
                </button> : ""}
              </div>
            </div> : ""}
          {chosenWeapon !== 0 ? <div
            className={"flex justify-center items-center"}
            style={{ flexGrow: 1 }}>
            <div className={"flex flex-col justify-center items-center "}>
              <NonInteractableWeapon weapon={weapon} />
              <br />
              <div>You</div>
            </div>
            <br />
            <div className={"flex items-center mx-4 mt-36"}>
              <span>vs</span>
            </div>
            <br />
            <div className={"flex flex-col justify-center items-center"}>
              <span>Player 2&apos;s choice...</span>
            </div></div>
            : ""}
        </div >);

    case "Player2Decided":
      return (
        <div
          className={"relative flex-1 flex flex-col flex-nowrap items-center"}
          style={{
            paddingTop: "4rem",
            color: "#FFFA83",
          }}
        >
          {/* This div displays status info */}
          <div
            className={"flex-1 flex flex-col w-full max-w-lg"}
            style={{ flexGrow: 0.5 }}
          >
            <span className={"text-4xl"}>Player 2 has chosen ⚔️</span>
            <br />
            <span className={"text-4xl"}>Choose your weapon 🤔</span>
            <br />
          </div>

          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-col w-full justify-center items-center  max-w-2xl"}
          >
            <div className="flex-1 flex flex-col w-full justify-center max-w-2xl"
              style={{ flexGrow: .9 }}>
              <WeaponSelector setWeapon={setWeapon} initialWeapon={weapon} />
              <div className="flex-1 flex justify-center items-center">
                {chosenWeapon === 0 ? (
                  <button
                    onClick={() => {
                      sendWeaponChoice(weapon);
                    }}
                    style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                    className="w-96 h-14 rounded-md text-xl"
                  >
                    Cement your choice 🗿
                  </button>
                ) : ""}
              </div>
            </div>
          </div>
        </div >
      );
    case "PlayerTimedout":
      return (
        <div
          className={"relative flex-1 flex flex-col flex-nowrap items-center"}
          style={{
            paddingTop: "4rem",
            color: "#FFFA83",
          }}
        >
          <div>
            Timed Out
          </div>
        </div>
      );
    case "EndScreen":
      return (
        <div
          className={"relative flex-1 flex flex-col flex-nowrap items-center"}
          style={{
            paddingTop: "4rem",
            color: "#FFFA83",
          }}
        >
          {/* This div displays status info */}
          <div
            className={"flex-1 flex flex-col w-full  max-w-lg"}
            style={{ flexGrow: 0 }}
          >
            <>
              <span className={"text-4xl"}>The match has ended.</span>
              <br />
              <span className={"text-4xl"}>
                {winner === "P1"
                  ? "You won! Nice job, and thanks for playing!"
                  : winner === "P2"
                    ? "You lost, better luck next time and thanks for playing!"
                    : "No one won. Get those spirits up, thanks for playing!"}
              </span>
            </>
          </div>

          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-row w-full justify-center max-w-2xl select-none"}
            style={{ flexGrow: 1 }}
          >
            <div className={"flex flex-col justify-center items-center"}>
              <NonInteractableWeapon weapon={weapon} />
              <br />
              <div>You</div>
            </div>
            <br />
            <div className={"flex items-center mx-4 mt-36"}>
              <span>vs</span>
            </div>
            <br />
            <div className={"flex flex-col justify-center items-center"}>
              <NonInteractableWeapon weapon={player2Weapon} />
              <br />
              <div>Player 2</div>
            </div>
          </div>
          {/* This div displays the rematch button */}
          <div
            className={"flex-1 flex flex-col w-full justify-center items-center  max-w-2xl"}
          >
            <div className="flex-1 flex flex-col w-full justify-center max-w-2xl"
              style={{ flexGrow: .9 }}>
              <div className="flex-1 flex justify-center items-center">
                {rematch === false ? <button
                  onClick={() => {
                    sendRematch()
                  }}
                  style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                  className="w-96 h-14 rounded-md text-xl"
                >
                  Wanna rematch? 😭
                </button> :
                  <span style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                    className="w-96 h-14 rounded-md 
                    text-xl flex justify-center 
                    items-center select-none">Waiting for response... 👀</span>}
              </div>
            </div>
          </div>
        </div>
      );
  }
};

export default Player1UI;

// --------- UTILS -----------

const copyToClipBoard = (text: string) => {
  /* Copy the text inside the text field */
  navigator.clipboard.writeText(text);

  /* Alert the copied text */
  alert("Copied the text: " + text);
};

const getRand = () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return arrayify(array);
};

const TimerComponent = (
  timer: TimerType,
  setTimer: React.Dispatch<React.SetStateAction<TimerType>>
) => {
  switch (timer.status) {
    case "idle":
      return <span></span>;
    case "running":
      return (
        <Timer
          expiryTimestamp={timer.defaultTime}
          timerState={{ timer, setTimer }}
        />
      );
    default:
      return <span></span>;
  }
};

const TimerExpired = (
  timer: TimerType,
  winner: Winner,
  player2Timedout: () => void
) => {
  switch (timer.expired) {
    case false:
      return <span></span>;
    case true:
      if (winner === "idle") {
        return (
          <div className={"text-sm flex flex-col items-center"}>
            <span>Player 2 timedout.</span>
            <span>
              Click{" "}
              <button
                className={"px-2 py-1 rounded-md"}
                style={{
                  color: "#FFFA83",
                  backgroundColor: "#FF005C",
                  width: "fit-content",
                }}
                onClick={async () => {
                  await player2Timedout();
                }}
              >
                here
              </button>{" "}
              to get both stakes back!
            </span>
            <br />
          </div>
        );
      }
    default:
      return <span></span>;
  }
};


const computeWinner = (p1Weapon: Weapon, p2Weapon: Weapon): Winner => {
  if (p1Weapon === p2Weapon) return "no one, a draw"
  if (strongMatchups[p1Weapon].includes(p2Weapon)) return "P1"
  return "P2"
}

