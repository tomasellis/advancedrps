import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { RPS, RPS__factory } from "../public/utils";
import Peer from "peerjs";
import initPeer from "../utils/initPeer";
import Timer from "./Timer";
import WeaponSelector from "./WeaponSelector";
import { externalIcon } from "../utils/svgIcons";
import NonInteractableWeapon from "./NonInteractableWeapon";

type Loading = {
  status: "loading" | "idle";
  msgToDisplay: string;
  reset: () => void;
};

enum Selection {
  "Null",
  "Rock",
  "Paper",
  "Scissors",
  "Spock",
  "Lizard",
}

type PeerMsg =
  | { _type: "ContractAddress"; address: string }
  | { _type: "Player2Moved"; weapon: number }
  | { _type: "Winner"; player: Winner }
  | { _type: "Player2Address"; address: string }
  | { _type: "Stake"; stake: string }
  | { _type: "TimetoutValue"; timeout: string }
  | { _type: "Player1Address"; address: string }
  | { _type: "Player1Weapon"; weapon: number }
  | { _type: "Connected" };

type Winner = "P1" | "P2" | "no one, a draw" | "idle";

type TimerType = {
  status: "running" | "idle" | "finished";
  defaultTime: Date;
  expired: boolean;
  reset: boolean;
};

type Mining = {
  status: "idle" | "mining";
  reset: () => void;
};

type ScreenToDisplay = "WaitingForPlayer1" | "SentWeapon" | "PlayerTimedout";

const Player2UI = ({
  peerId,
  currentAccount,
}: {
  peerId: string;
  currentAccount: string;
}) => {
  const [weapon, setWeapon] = useState<number>(0);
  const [stake, setStake] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [player1Address, setPlayer1Address] = useState<string>("");
  const [player1Weapon, setPlayer1Weapon] = useState<number>(0);
  const [connToPlayer, setConnToPlayer] = useState<Peer.DataConnection>();
  const [winner, setWinner] = useState<"P1" | "P2" | "no one, a draw" | "idle">(
    "idle"
  );
  const [screenToDisplay, setScreenToDisplay] =
    useState<ScreenToDisplay>("WaitingForPlayer1");

  const [mining, setMining] = useState<Mining>({
    status: "idle",
    reset: () => setMining({ ...mining, status: "idle" }),
  });

  const [timer, setTimer] = useState<TimerType>({
    status: "idle",
    defaultTime: new Date(),
    expired: false,
    reset: false,
  });

  const getTimeSinceLastAction = async (contractAddress: string) => {
    try {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);

        const RPSContract = RPS__factory.connect(contractAddress, provider);

        const lastActionRaw = await RPSContract.lastAction();

        const timeout = await RPSContract.TIMEOUT();

        const now = Math.round(Date.now() / 1000);

        const secondsPassed = ethers.BigNumber.from(now).sub(lastActionRaw);

        const secondsFinal = timeout.sub(secondsPassed).toNumber();

        const time = new Date();

        time.setSeconds(time.getSeconds() + secondsFinal);

        setTimer({
          ...timer,
          reset: true,
          status: "running",
          defaultTime: time,
        });
      }
    } catch (err) {
      console.log(err);
    }
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

        msg = { _type: "Player2Address", address: currentAccount };
        conn.send(msg);

        // Receive messages
        conn.on("data", (data: PeerMsg) => {
          switch (data._type) {
            case "Player1Address":
              return setPlayer1Address(data.address);
            case "ContractAddress":
              return setContractAddress(data.address);
            case "Stake":
              return setStake(data.stake);
            case "Player1Weapon":
              return setPlayer1Weapon(data.weapon);
            case "Winner":
              setTimer({ ...timer, status: "idle", reset: true });
              return setWinner(data.player);
            default:
              return;
          }
        });
      });
    })();
    // eslint-disable-next-line
  }, []);

  const sendWeaponChoice = async (
    weapon: number,
    contractAddress: string,
    stake: string
  ) => {
    try {
      setScreenToDisplay("SentWeapon");
      setMining({ ...mining, status: "mining" });

      // @ts-ignore
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        const RPSContract = new ethers.Contract(
          contractAddress,
          RPS__factory.abi,
          signer
        ) as RPS;

        // Provide feedback

        const playTx = await RPSContract.play(weapon, {
          value: ethers.utils.parseEther(stake),
          gasLimit: 1_000_000,
        });

        await playTx.wait();

        mining.reset();

        getTimeSinceLastAction(contractAddress);

        let msg: PeerMsg = { _type: "Player2Moved", weapon: weapon };
        connToPlayer?.send(msg);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const player1Timedout = async () => {
    try {
      setScreenToDisplay("PlayerTimedout");
      //@ts-ignore
      const { ethereum } = window;

      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      const contract = RPS__factory.connect(contractAddress, signer);

      setMining({ ...mining, status: "idle" });

      const timeoutTx = await contract.j1Timeout();

      await timeoutTx.wait();

      mining.reset();
    } catch (err) {
      console.log(err);
    }
  };

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
            {contractAddress === "" ? (
              <>
                <span className={"text-4xl"}>Linked with Player 1!</span>
                <br />
                <span className={"text-4xl"}>
                  Waiting for the match to start.
                </span>
              </>
            ) : (
              <>
                <span className={"text-4xl"}>The match has started!</span>
                <br />
                <span className={"text-4xl"}>
                  Please choose a weapon, if you decide to play you'll be
                  staking {stake} ETH.
                </span>
              </>
            )}
          </div>

          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-col w-full"}
            style={{ flexGrow: 0.5 }}
          >
            <WeaponSelector setWeapon={setWeapon} initialWeapon={weapon} />
            <div className="flex-1 flex justify-center items-center">
              {weapon !== 0 && contractAddress !== "" ? (
                <button
                  onClick={() => {
                    sendWeaponChoice(weapon, contractAddress, stake);
                  }}
                  style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                  className="w-96 h-14 rounded-md text-xl"
                >
                  Click here to confirm selection!
                </button>
              ) : (
                ""
              )}
            </div>
          </div>
          {/* This div displays additional info */}
          <div
            className={"flex-1 flex flex-row w-full "}
            style={{ flexGrow: 0.2, maxHeight: "100px" }}
          >
            <div
              style={{ color: "#FFFA83", flexGrow: 0.8 }}
              className={"flex-1 flex flex-col flex-nowrap justify-center"}
            >
              {player1Address === "" ? (
                ""
              ) : (
                <a
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${player1Address}`}
                  className={"px-2 flex flex-row text-xs"}
                  style={{ maxWidth: "fit-content" }}
                >
                  {externalIcon}
                  <span style={{ width: "370px" }}>
                    OPPONENT: {player1Address}
                  </span>
                </a>
              )}
              <br />
              {contractAddress === "" ? (
                ""
              ) : (
                <a
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${contractAddress}`}
                  className={"px-2 flex flex-row text-xs"}
                  style={{ maxWidth: "fit-content" }}
                >
                  {externalIcon}
                  <span style={{ width: "370px" }}>
                    MATCH: {contractAddress}
                  </span>
                </a>
              )}
            </div>
            <div className={"flex-1 flex flex-col"}>
              {TimerComponent(timer, setTimer)}
              {TimerExpired(timer, winner, player1Timedout)}
            </div>
          </div>
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
            {mining.status === "mining" ? (
              <>
                <span className={"text-4xl"}>Please check your wallet.</span>
                <br />
                <span className={"text-4xl"}>
                  Confirm sending your choice to the blockchain.
                </span>
              </>
            ) : winner === "idle" ? (
              <>
                <span className={"text-4xl"}>
                  Waiting for Player 1's confirmation.
                </span>
              </>
            ) : (
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
            )}
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
            <div className={"flex items-center mx-4"}>
              <span>vs</span>
            </div>
            <br />
            {mining.status === "mining" ? (
              <div className={"flex flex-col justify-center items-center"}>
                <div>Waiting for the blockchain</div>
              </div>
            ) : player1Weapon === 0 ? (
              <div className={"flex flex-col justify-center items-center"}>
                <div>Waiting for Player 1's response</div>
              </div>
            ) : (
              <div className={"flex flex-col justify-center items-center"}>
                <NonInteractableWeapon weapon={player1Weapon} />
                <br />
                <div>Player 1's choice</div>
              </div>
            )}
          </div>
          {/* This div displays additional info */}
          <div
            className={"flex-1 flex flex-row w-full pl-10 "}
            style={{ flexGrow: 0.2, maxHeight: "100px" }}
          >
            <div
              style={{ color: "#FFFA83", flexGrow: 0.8 }}
              className={"flex-1 flex flex-col flex-nowrap justify-center"}
            >
              {player1Address === "" ? (
                ""
              ) : (
                <a
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${player1Address}`}
                  className={"px-2 flex flex-row text-xs"}
                  style={{ maxWidth: "fit-content" }}
                >
                  {externalIcon}
                  <span style={{ width: "370px" }}>
                    OPPONENT: {player1Address}
                  </span>
                </a>
              )}
              <br />
              {contractAddress === "" ? (
                ""
              ) : (
                <a
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${contractAddress}`}
                  className={"px-2 flex flex-row text-xs"}
                  style={{ maxWidth: "fit-content" }}
                >
                  {externalIcon}
                  <span style={{ width: "370px" }}>
                    MATCH: {contractAddress}
                  </span>
                </a>
              )}
            </div>
            <div className={"flex-1 flex flex-col"}>
              {TimerComponent(timer, setTimer)}
              {TimerExpired(timer, winner, player1Timedout)}
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
            {mining.status === "mining" ? (
              <span className={"text-4xl "}>
                Sending you both stakes to your wallet.
              </span>
            ) : (
              <span className={"text-4xl "}>
                Sent! Please check your wallet, and thanks for playing.
              </span>
            )}
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
