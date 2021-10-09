import react, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { RPS, RPS__factory } from "../../public/utils";
import Peer from "peerjs";
import styles from "../../styles/Home.module.css";
import initPeer from "../utils/initPeer";
import Timer from "./Timer";

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
  | { _type: "Connected" };

type Winner = "P1" | "P2" | "no one, a draw" | "idle";

type TimerType = {
  status: "running" | "idle" | "finished";
  defaultTime: Date;
  expired: boolean;
  reset: boolean;
};

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
  const [connToPlayer, setConnToPlayer] = useState<Peer.DataConnection>();
  const [winner, setWinner] = useState<"P1" | "P2" | "no one, a draw" | "idle">(
    "idle"
  );

  const [loading, setLoading] = useState<Loading>({
    status: "idle",
    msgToDisplay: "",
    reset: () => {
      setLoading({ ...loading, status: "idle", msgToDisplay: "" });
    },
  });

  const [timer, setTimer] = useState<TimerType>({
    status: "idle",
    defaultTime: new Date(),
    expired: false,
    reset: false,
  });

  const createButtons = () => {
    let buttons = [];

    for (const value in Selection) {
      if (isNaN(Number(value)) || Selection[value] === "Null") {
        continue;
      }
      buttons.push(
        <button
          key={value}
          style={{ border: weapon === parseInt(value) ? "2px solid red" : "" }}
          onClick={() => setWeapon(parseInt(value))}
        >
          {Selection[value]}
        </button>
      );
    }

    return buttons;
  };

  const buttons = createButtons();

  const getTimeSinceLastAction = async (contractAddress: string) => {
    try {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);

        const RPSContract = RPS__factory.connect(contractAddress, provider);

        const lastActionRaw = await RPSContract.lastAction();
        const timeout = await RPSContract.TIMEOUT();

        console.log("TIMETOUT", timeout);
        console.log("LAST ACTION", lastActionRaw);
        console.log("LAST ACTION", lastActionRaw);

        const now = Math.round(Date.now() / 1000);

        const secondsPassed = ethers.BigNumber.from(now).sub(lastActionRaw);
        const secondsFinal = timeout.sub(secondsPassed).toNumber();

        const time = new Date();
        time.setSeconds(time.getSeconds() + secondsFinal);
        console.log("SECS", time.toUTCString());

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

  useEffect(() => {
    (async () => {
      const peer = await initPeer();

      console.log("Bout to connect to,", peerId);
      const conn = await peer.connect(peerId, { reliable: true });
      setConnToPlayer(conn);
      conn.on("error", function (err) {
        console.log("Error: ", err);
      });

      conn.on("open", () => {
        conn.send("We are one!");
        let msg: PeerMsg = { _type: "Player2Address", address: currentAccount };
        conn.send(msg);

        // Receive messages
        conn.on("data", (data: PeerMsg) => {
          console.log("From peer connection:", data);
          switch (data._type) {
            case "ContractAddress":
              return setContractAddress(data.address);
            case "Stake":
              return setStake(data.stake);
            case "Winner":
              loading.reset();
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
        setLoading({
          ...loading,
          status: "loading",
          msgToDisplay: "Sending your choice to the blockchain...",
        });

        const playTx = await RPSContract.play(weapon, {
          value: ethers.utils.parseEther(stake),
          gasLimit: 1_000_000,
        });

        await playTx.wait();

        loading.reset();

        let msg: PeerMsg = { _type: "Player2Moved", weapon: weapon };
        connToPlayer?.send(msg);

        getTimeSinceLastAction(RPSContract.address);

        setLoading({
          ...loading,
          status: "loading",
          msgToDisplay: "Choice sent, now waiting for player 1...",
        });
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const player1Timedout = async () => {
    try {
      //@ts-ignore
      const { ethereum } = window;

      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      const contract = RPS__factory.connect(contractAddress, signer);

      setLoading({
        ...loading,
        status: "loading",
        msgToDisplay:
          "Cleaning things up, in a few moments you'll receive the appropiate ETH",
      });
      const timeoutTx = await contract.j1Timeout();

      await timeoutTx.wait();

      setLoading({
        ...loading,
        status: "loading",
        msgToDisplay: "Done! Please check your wallet's balance!",
      });
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (contractAddress === "") {
      getTimeSinceLastAction(contractAddress);
      return setLoading({
        ...loading,
        status: "loading",
        msgToDisplay: "Linked! Now waiting for player 1's decision...",
      });
    }
    return loading.reset();
  }, [contractAddress]);

  return (
    <div className={styles.container}>
      {timer.status === "idle" ? (
        ""
      ) : (
        <Timer
          expiryTimestamp={timer.defaultTime}
          timerState={{ timer, setTimer }}
        />
      )}
      {timer.expired === false ? (
        ""
      ) : winner === "idle" ? (
        <div>
          <span>
            Player 1 has timedout, you can proceed with this match by pressing
          </span>
          <br />
          <button
            onClick={async () => {
              await player1Timedout();
            }}
          >
            here
          </button>
        </div>
      ) : (
        ""
      )}
      {loading.status === "loading" ? (
        `${loading.msgToDisplay}`
      ) : (
        <div>
          {winner === "idle" ? (
            <div>
              <div>
                {contractAddress === ""
                  ? ""
                  : `The contract's address is ${contractAddress}`}
              </div>

              <div>
                {stake !== ""
                  ? `The player 1 has staked: ${stake}ETH, should you play with them, you'll be staking the same quantity`
                  : ""}
              </div>

              <br />
              {stake !== "" ? <div>Choose an option: {buttons}</div> : ""}

              <br />

              <button
                disabled={
                  weapon !== 0 &&
                  contractAddress !== "" &&
                  stake !== "" &&
                  winner === "idle"
                    ? false
                    : true
                }
                onClick={() => sendWeaponChoice(weapon, contractAddress, stake)}
              >
                Send your weapon!
              </button>
            </div>
          ) : (
            `The winner was ${winner}, nice moves`
          )}
        </div>
      )}
    </div>
  );
};

export default Player2UI;
