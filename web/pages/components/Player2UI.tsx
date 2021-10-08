import react, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { RPS, RPS__factory } from "../../public/static/utils/typechain";
import Peer from "peerjs";
import styles from "../../styles/Home.module.css";

const Player2UI = ({ peerId }: { peerId: string; currentAccount: string }) => {
  const [weapon, setWeapon] = useState<number>(0);
  const [stake, setStake] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [waitingForPlayer, setWaitingForPlayer] = useState<boolean>(false);
  const [connToPlayer, setConnToPlayer] = useState<Peer.DataConnection>();

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

  const buttons = createButtons();

  useEffect(() => {
    import("peerjs").then(async ({ default: Peer }) => {
      const initPeer = (): Promise<Peer> =>
        new Promise((resolve, reject) => {
          const peer = new Peer();
          peer.on("error", (err) => {
            console.error(err);
            reject(`Could not create peer ${err.toString()}`);
          });

          peer.on("open", (_) => {
            resolve(peer);
          });
        });

      const peer = await initPeer();

      const conn = peer.connect(peerId, { reliable: true });

      conn.on("open", () => {
        conn.send("We are connected!");
        // Receive messages
        conn.on("data", (data) => {
          console.log(data);
          if (data.address) {
            setContractAddress(data.address);
          }
        });
      });
      setConnToPlayer(conn);
    });
  }, []);

  const checkContract = async () => {
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
        const stakeValueRaw = await RPSContract.stake();
        const stakeValue = ethers.utils.formatEther(stakeValueRaw);

        setStake(stakeValue);
      }
    } catch (err) {
      console.log(err);
    }
  };

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

        console.log("Sending P2 move...");
        const playTx = await RPSContract.play(weapon, {
          value: ethers.utils.parseEther(stake),
        });
        await playTx.wait();

        console.log("Sent P2 move ---- !");
        setWaitingForPlayer(true);
        connToPlayer?.send({ justPlayed: true });
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (contractAddress !== "") {
      checkContract();
    }
  }, [contractAddress]);

  return (
    <div className={styles.container}>
      {waitingForPlayer === true ? (
        "Waiting for player..."
      ) : (
        <div>
          <span>{contractAddress}</span>
          <div>Choose an option: {buttons}</div>
          <br />

          <div>You are about to stake: {stake !== "" ? stake : "..."} ETH</div>
          <br />
          <button
            disabled={
              weapon !== 0 && contractAddress !== "" && stake !== ""
                ? false
                : true
            }
            onClick={() => sendWeaponChoice(weapon, contractAddress, stake)}
          >
            Send move!
          </button>
        </div>
      )}
    </div>
  );
};

export default Player2UI;
