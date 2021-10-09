import { ContractFactory, ethers } from "ethers";
import { arrayify, solidityKeccak256 } from "ethers/lib/utils";
import Peer from "peerjs";
import react, { useEffect, useState } from "react";
import { RPS__factory } from "../../public/utils";
import styles from "../../styles/Home.module.css";
import initPeer from "../utils/initPeer";
import Timer from "./Timer";

const BASE_URL = process.env.NEXT_PUBLIC_BASEURL || "http://localhost:3000";

type PeerMsg =
  | { _type: "ContractAddress"; address: string }
  | { _type: "Player2Moved"; weapon: number }
  | { _type: "Winner"; player: Winner }
  | { _type: "Player2Address"; address: string }
  | { _type: "Stake"; stake: string }
  | { _type: "TimetoutValue"; timeout: string }
  | { _type: "Connected" };

type Winner = "P1" | "P2" | "no one, a draw" | "idle";

type Loading = {
  status: "loading" | "idle";
  msgToDisplay: string;
  reset: () => void;
};

type TimerType = {
  status: "running" | "idle" | "finished";
  defaultTime: Date;
  expired: boolean;
  reset: boolean;
};

const Player1UI = () => {
  const [weapon, setWeapon] = useState<number>(0);
  const [stake, setStake] = useState<string>("");
  const [player2Address, setPlayer2Address] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [peerId, setPeerId] = useState<string>("");
  const [connState, setConnState] = useState<Peer.DataConnection>();
  const [player2Response, setPlayer2Response] = useState<number>(0);
  const [loading, setLoading] = useState<Loading>({
    status: "idle",
    msgToDisplay: "",
    reset: () => {
      setLoading({ ...loading, status: "idle", msgToDisplay: "" });
    },
  });
  const [winner, setWinner] = useState<Winner>("idle");
  const [salt, setSalt] = useState<Uint8Array | null>();
  const [timer, setTimer] = useState<TimerType>({
    status: "idle",
    defaultTime: new Date(),
    expired: false,
    reset: false,
  });

  const getRand = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return arrayify(array);
  };

  enum Selection {
    "Null",
    "Rock",
    "Paper",
    "Scissors",
    "Spock",
    "Lizard",
  }

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

  const createMatch = async (
    stake: string,
    weapon: number,
    player2Address: string
  ) => {
    try {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        const factory = new ContractFactory(
          RPS__factory.abi,
          RPS__factory.bytecode,
          signer
        ) as RPS__factory;

        // Setup salt
        const saltVar = getRand();
        setSalt(saltVar);

        const p1Hash = solidityKeccak256(
          ["uint8", "uint256"],
          [weapon, saltVar]
        );
        console.log("Hashing weapon", weapon, "salt", saltVar);
        const RPSDeployed = await factory.deploy(p1Hash, player2Address, {
          value: ethers.utils.parseEther(stake),
        });

        console.log("Deploying...");

        setLoading({
          ...loading,
          status: "loading",
          msgToDisplay: "Deploying contract to the blockchain...",
        });
        await RPSDeployed.deployed();

        console.log("Deployed !!", RPSDeployed.address);

        setLoading({
          ...loading,
          status: "loading",
          msgToDisplay: "Now waiting for player 2's decision...",
        });

        setContractAddress(RPSDeployed.address);
        const timeoutValue = await RPSDeployed.TIMEOUT();
        const parsedTimeoutValue = ethers.utils.formatEther(timeoutValue);

        getTimeSinceLastAction(RPSDeployed.address);
        // Send the contract address to peer
        let msg: PeerMsg = {
          _type: "ContractAddress",
          address: RPSDeployed.address,
        };
        connState?.send(msg);

        // Send the stake quantity to peer
        msg = { _type: "Stake", stake: stake };
        connState?.send(msg);

        // Send timeout value
        msg = { _type: "TimetoutValue", timeout: parsedTimeoutValue };
        connState?.send(msg);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

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

  const checkWhoWon = async () => {
    try {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum && salt) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();

        const RPSContract = await RPS__factory.connect(contractAddress, signer);

        console.log("Checking who won");
        const solveTx = await RPSContract.solve(weapon, salt, {
          gasLimit: 100_000,
        });
        await solveTx.wait();
        console.log("Done checking! Check your wallet!");
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const decideWinnerLocally = (
    weapon: Selection,
    player2Response: Selection
  ): Winner => {
    const win = (_c1: Selection, _c2: Selection) => {
      if (_c1 == _c2) return false;
      // They played the same so no winner.
      else if (_c1 % 2 == _c2 % 2) return _c1 < _c2;
      else return _c1 > _c2;
    };

    if (win(weapon, player2Response)) return "P1";
    else if (win(player2Response, weapon)) return "P2";
    else return "no one, a draw";
  };

  const player2Timedout = async () => {
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
      const timeoutTx = await contract.j2Timeout();

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

  const buttons = createButtons();

  // Decide who is the winner
  useEffect(() => {
    if (player2Response !== 0 && winner === "idle")
      (async () => {
        setLoading({
          ...loading,
          status: "loading",
          msgToDisplay:
            "Player 2's weapon received. Please check Metamask to finish computing the winner...",
        });
        await checkWhoWon();
        const actualWinner = decideWinnerLocally(weapon, player2Response);
        setWinner(actualWinner);
        if (actualWinner !== "idle") {
          const msg: PeerMsg = { _type: "Winner", player: actualWinner };
          connState?.send(msg);
          setLoading({
            ...loading,
            status: "loading",
            msgToDisplay: `The winner was: ${actualWinner}. Nice moves. To play again just refresh the page.`,
          });
        }
      })();
  }, [player2Response]);

  // Peer js setup, dinamically as to please NextJS
  useEffect(() => {
    console.log("Trying to reach PeerJS servers");
    const asyncFn = async () => {
      console.log("Trying to create Peer");
      const peer = await initPeer();

      console.log("Peer", peer);
      // Save own peer id
      setPeerId(peer.id);
      peer.on("open", (id) => {
        console.log("Peer open,", id);
      });

      peer.on("error", (e) => console.log("ERROR", e));

      peer.on("connection", (conn) => {
        conn.on("error", (e) => console.log("ConnERROR", e));

        conn.on("open", () => {
          conn.send("Linked with Peer 1!");
        });

        // Save connection for future use
        setConnState(conn);

        // Set event listeners for Peer communication
        conn.on("data", (data: PeerMsg) => {
          console.log("Data from Peer 2", data);

          switch (data._type) {
            case "Player2Moved":
              setTimer({ ...timer, expired: false, status: "idle" });
              setLoading({
                ...loading,
                status: "loading",
                msgToDisplay:
                  "Player 2 has decided! Check Metamask to accept the final move!",
              });
              return setPlayer2Response(data.weapon);

            case "Player2Address":
              setTimer({ ...timer, expired: false, status: "idle" });
              return setPlayer2Address(data.address);

            default:
              return console.log("Default");
          }
        });
      });
    };
    asyncFn();
    // eslint-disable-next-line
  }, []);

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
            Player 2 has timedout, you can proceed with this match by pressing
          </span>
          <br />
          <button
            onClick={async () => {
              await player2Timedout();
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
          <span>
            {contractAddress !== ""
              ? `Contract address: ${contractAddress}`
              : ""}
          </span>
          <span>
            Share this with your opponent to connect with eachother: {BASE_URL}
            /?peerId={peerId}
            <br />
            <button
              onClick={() => copyToClipBoard(`${BASE_URL}/?peerId=${peerId}`)}
            >
              Copy to Clipboard
            </button>
          </span>
          <div>
            <div>Choose an option: {buttons}</div>
            <br />

            <div>
              {player2Address !== ""
                ? `You are about to fight: ${player2Address}`
                : "Waiting for player 2 to connect..."}
            </div>
            <br />

            <div>
              How much do you want to stake:{" "}
              <input
                placeholder={"Stake here"}
                onChange={(e) => {
                  setStake(e.target.value);
                }}
              ></input>
            </div>
            <br />

            <button
              disabled={
                weapon !== 0 &&
                ethers.utils.isAddress(player2Address) &&
                parseFloat(stake) > 0 &&
                peerId !== ""
                  ? false
                  : true
              }
              onClick={() => createMatch(stake, weapon, player2Address)}
            >
              Create match
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Player1UI;

// --------- UTILS

const copyToClipBoard = (text: string) => {
  /* Copy the text inside the text field */
  navigator.clipboard.writeText(text);

  /* Alert the copied text */
  alert("Copied the text: " + text);
};
