import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { RPS, RPS__factory } from "../public/utils";
import Peer from "peerjs";
import initPeer from "../utils/initPeer";
import Timer from "./Timer";
import WeaponSelector from "./WeaponSelector";
import { externalIcon } from "../utils/svgIcons";
import NonInteractableWeapon from "./NonInteractableWeapon";
import { useInterval } from "../utils/useInterval";

type Loading = {
  status: "loading" | "idle";
  msgToDisplay: string;
  reset: () => void;
};

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
  | "WaitingForPlayer1"
  | "SentWeapon"
  | "PlayerTimedout"
  | "EndScreen";

// To fix: Favicon change
// To fix: Alert on click
// To fix: Timeout for local player
// To fix: rejected transaction

const Player2UI = ({
  peerId,
}: {
  peerId: string;
}) => {
  const [weapon, setWeapon] = useState<number>(0);
  const [chosenWeapon, setChosenWeapon] = useState<number>(0)
  const [player1Weapon, setPlayer1Weapon] = useState<number>(0);
  const [connToPlayer, setConnToPlayer] = useState<Peer.DataConnection>();
  const [winner, setWinner] = useState<Winner>("idle");
  const [rematch, setRematch] = useState<boolean>(false)
  const [rematchP1, setRematchP1] = useState<boolean>(false)
  const [screenToDisplay, setScreenToDisplay] =
    useState<ScreenToDisplay>("WaitingForPlayer1");

  const [timer, setTimer] = useState<TimerType>({
    status: "idle",
    defaultTime: new Date(),
    expired: false,
    reset: false,
  });

  const resetEverything = () => {
    setScreenToDisplay("WaitingForPlayer1")
    setWeapon(0)
    setChosenWeapon(0)
    setWinner("idle")
    setPlayer1Weapon(0)
    setRematch(false)
    setRematchP1(false)
  }

  const sendWeaponChoice = async (
    weapon: number,
  ) => {
    setScreenToDisplay("SentWeapon");
    // @ts-ignore
    // Provide feedback
    // Develop
    setChosenWeapon(weapon)
    console.info('Sending weapon choice', weapon)
    const msg: PeerMsg = {
      _type: "Player2Weapon",
      weapon: weapon
    }
    connToPlayer?.send(msg)
  };

  const sendRematch = () => {
    const msg: PeerMsg = {
      _type: "Rematch",
      rematch: true
    }
    connToPlayer?.send(msg)
    setRematch(true)
  }

  const player1Timedout = async () => {
    setScreenToDisplay("PlayerTimedout");
    //@ts-ignore
    console.info('Player 1 timed out')
    alert('Player 1 timed out')
  };

  // PeerJS setup for communication with P1
  useEffect(() => {
    (async () => {
      const peer = await initPeer();

      const conn = await peer.connect(peerId, { reliable: true });

      setConnToPlayer(conn);

      conn.on("error", function (err) {
        console.log("CONNError: ", err);
      });

      conn.on("open", () => {
        let msg: PeerMsg = { _type: "Connected" };
        conn.send(msg);

        // Receive messages
        conn.on("data", (data: PeerMsg) => {
          switch (data._type) {
            case "Player1Weapon":
              console.log('Got wep 1', data.weapon)
              return setPlayer1Weapon(data.weapon)
            case "Rematch":
              return setRematchP1(true)
            default:
              return;
          }
        });
      });
    })();
    // eslint-disable-next-line
  }, [peerId]);

  useEffect(() => {
    if (chosenWeapon !== 0 && player1Weapon !== 0) {
      console.log(chosenWeapon, player1Weapon, computeWinner(player1Weapon, chosenWeapon))
      setWinner(computeWinner(player1Weapon, chosenWeapon))
    }
  }, [chosenWeapon, player1Weapon])

  useEffect(() => {
    if (winner !== "idle") {
      setScreenToDisplay("EndScreen")
    }
  }, [winner])

  useEffect(() => {
    if (rematch && rematchP1) {
      resetEverything()
    }
  }, [rematch, rematchP1])

  switch (screenToDisplay) {
    case "WaitingForPlayer1":
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
            {player1Weapon === 0 ? (
              <>
                <span className={"text-4xl"}>Linked with Player 1 🤝</span>
                <br />
              </>
            ) : (
              <>
                <span className={"text-4xl"}>Player 1 has chosen ⚔️</span>
                <br />
              </>
            )}
            <span className={"text-4xl"}>
              Choose your weapon 🤔
            </span>
          </div>

          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-col w-full justify-center items-center  max-w-2xl"}
          >
            <div className="flex-1 flex flex-col w-full justify-center max-w-2xl"
              style={{ flexGrow: 1 }}>
              <WeaponSelector setWeapon={setWeapon} initialWeapon={weapon} />
              <div className="flex-1 flex justify-center items-center">
                {weapon !== 0 ? (
                  <button
                    onClick={() => {
                      sendWeaponChoice(weapon);
                    }}
                    style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                    className="w-96 h-14 rounded-md text-xl"
                  >
                    Cement your choice 🗿
                  </button>
                ) : (
                  ""
                )}
              </div>
            </div>
          </div>
          {/* This div displays additional info */}
          {/* <div
            className={"flex-1 flex flex-row w-full pl-10 "}
            style={{ flexGrow: 0.2, maxHeight: "100px" }}
          >
            <div className={"flex-1 flex flex-col"}>
              {TimerComponent(timer, setTimer)}
              {TimerExpired(timer, winner, player1Timedout)}
            </div>
          </div> */}
        </div>
      );
    case "SentWeapon":
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
            style={{ flexGrow: 0.5 }}
          >
            <>
              <span className={"text-4xl"}>
                Weapon chosen ⚔️
              </span>
              <br />
              <span className={"text-4xl"}>
                Waiting for Player 1... 😴
              </span>
            </>
          </div>
          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-row w-full justify-center max-w-2xl"}
            style={{ flexGrow: 0.5 }}
          >
            <div className={"flex flex-col justify-center items-center"}>
              <NonInteractableWeapon weapon={weapon} />
              <br />
              <div>Your choice</div>
            </div>
            <br />
            <div className={"flex items-center mx-4 mt-36 pl-10 "}>
              <span>vs</span>
            </div>
            <br />
            <div className={"flex flex-col justify-center items-center"}>
              <div>Player 1&apos;s choice...</div>
            </div>
          </div>
        </div>
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
          {/* This div displays status info */}
          <div
            className={"flex-1 flex flex-col w-full   max-w-lg"}
            style={{ flexGrow: 0.5 }}
          >
            <span className={"text-4xl "}>Player 1 timedout.</span>
            <br />
            Player 1 Timedout
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
                {winner === "P2"
                  ? "You won! Nice job, and thanks for playing!"
                  : winner === "P1"
                    ? "You lost, better luck next time and thanks for playing!"
                    : "No one won. Get those spirits up, thanks for playing!"}
              </span>
            </>
          </div>
          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-row w-full justify-center max-w-2xl"}
            style={{ flexGrow: 1 }}
          >
            <div className={"flex flex-col justify-center items-center select-none"}>
              <NonInteractableWeapon weapon={weapon} />
              <br />
              <div>You</div>
            </div>
            <br />
            <div className={"flex items-center mx-4 mt-36 select-none"}>
              <span>vs</span>
            </div>
            <br />
            <div className={"flex flex-col justify-center items-center select-none"}>
              <NonInteractableWeapon weapon={player1Weapon} />
              <br />
              <div>Player 1</div>
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
                  className="w-96 h-14 rounded-md text-xl select-none"
                >
                  Wanna rematch? 😭
                </button> :
                  <span style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                    className="w-96 h-14 
                    rounded-md text-xl 
                    flex justify-center 
                    items-center select-none">Waiting for response... 👀</span>}
              </div>
            </div>
          </div>
        </div>
      );
  }
};


export default Player2UI;

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
              to continue!
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