import { ContractFactory, ethers } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import Peer from "peerjs";
import react, { useEffect, useState } from "react";
import { RPS, RPS__factory } from "../../public/utils";
import styles from "../../styles/Home.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BASEURL || "http://localhost:3000";

const Player1UI = () => {
  const SALT = crypto.getRandomValues(new Uint32Array(10))[0];
  const [weapon, setWeapon] = useState<number>(0);
  const [stake, setStake] = useState<string>("");
  const [player2Address, setPlayer2Address] = useState<string>("");
  const [matchAddress, setMatchAddress] = useState<string>("");
  const [peerId, setPeerId] = useState<string>("");
  const [peerState, setPeerState] = useState<Peer>();
  const [player2Response, setPlayer2Response] = useState<boolean>(false);

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

        const p1Hash = solidityKeccak256(["uint8", "uint256"], [weapon, SALT]);

        const RPSDeployed = await factory.deploy(p1Hash, player2Address, {
          value: ethers.utils.parseEther(stake),
        });

        console.log("Deploying...");
        await RPSDeployed.deployed();
        console.log("Deployed !!", RPSDeployed.address);
        setMatchAddress(RPSDeployed.address);
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const checkWhoWon = async () => {
    try {
      // @ts-ignore
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const RPSContract = new ethers.Contract(
          matchAddress,
          RPS__factory.abi,
          signer
        ) as RPS;

        console.log("Checking who won");
        const solveTx = await RPSContract.solve(weapon, SALT);
        await solveTx.wait();
        console.log("Done checking! Check your wallet!");
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      console.log(error);
    }
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
      setPeerState(peer);
      setPeerId(peer.id);
    });
    // eslint-disable-next-line
  }, []);

  // When we get the contract address, create an event listener
  useEffect(() => {
    if (matchAddress !== "" && peerState) {
      peerState.on("connection", (conn) => {
        conn.on("data", (data) => {
          if (data.justPlayed !== undefined) {
            setPlayer2Response(true);
          }
          conn.send("We are connected, glhf");
          console.log(data);
          conn.send({ address: matchAddress });
        });
      });
    }
    // eslint-disable-next-line
  }, [matchAddress]);

  return (
    <div className={styles.container}>
      <span>
        {peerId} -- {matchAddress}
      </span>
      {matchAddress === "" ? (
        <div>
          <div>Choose an option: {buttons}</div>
          <br />

          <div>
            Your opponent&apos;s address:{" "}
            <input
              placeholder={"Please input here"}
              onChange={(e) => {
                setPlayer2Address(e.target.value);
              }}
            ></input>
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
      ) : (
        <div>
          <div>
            The match has started, share this with your opponent: {BASE_URL}
            /?peerId={peerId}
          </div>
          <div>Now playing: {Selection[weapon]} vs ...</div>
          <div>
            {player2Response === false ? (
              "Awaiting player 2's move"
            ) : (
              <button
                onClick={() => {
                  checkWhoWon();
                }}
              >
                Check who won
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Player1UI;