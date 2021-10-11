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

const BASE_URL = process.env.NEXT_PUBLIC_BASEURL || "http://localhost:3000";

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

type Mining = {
  status: "mining" | "idle";
  reset: () => void;
};

type TimerType = {
  status: "running" | "idle" | "finished";
  defaultTime: Date;
  expired: boolean;
  reset: boolean;
};

enum Selection {
  "Null",
  "Rock",
  "Paper",
  "Scissors",
  "Spock",
  "Lizard",
}

type ScreenToDisplay =
  | "WaitingForP2Connection"
  | "Player2Connected"
  | "Player2Decided"
  | "PlayerTimedout";

interface Deployed extends RPS {
  code: number;
  message: string;
}

const Player1UI = (props: { accountAddress: string }) => {
  const INITIAL_STAKE = "0.001";
  const [weapon, setWeapon] = useState<number>(0);
  const [stake, setStake] = useState<string>(INITIAL_STAKE);
  const [player2Address, setPlayer2Address] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [peerId, setPeerId] = useState<string>("");
  const [connState, setConnState] = useState<Peer.DataConnection>();
  const [player2Response, setPlayer2Response] = useState<number>(0);
  const [mining, setMining] = useState<Mining>({
    status: "idle",
    reset: () => {
      setMining({ ...mining, status: "idle" });
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

  const [screenToDisplay, setScreenToDisplay] = useState<ScreenToDisplay>(
    "WaitingForP2Connection"
  );

  const win = (_c1: Selection, _c2: Selection) => {
    if (_c1 == _c2) return "draw";
    // They played the same so no winner.
    else if (_c1 % 2 == _c2 % 2) return _c1 < _c2;
    else return _c1 > _c2;
  };

  const createMatch = async (
    stake: string,
    weapon: number,
    player2Address: string
  ) => {
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

      const p1Hash = solidityKeccak256(["uint8", "uint256"], [weapon, saltVar]);

      setMining({ ...mining, status: "mining" });

      factory
        .deploy(p1Hash, player2Address, {
          value: ethers.utils.parseEther(stake),
        })
        .then(async (RPSDeployed) => {
          await RPSDeployed.deployed();

          setContractAddress(RPSDeployed.address);
          await getTimeSinceLastAction(RPSDeployed.address);

          // Send the contract address to peer
          let msg: PeerMsg = {
            _type: "ContractAddress",
            address: RPSDeployed.address,
          };
          connState?.send(msg);

          // Send the stake quantity to peer
          msg = { _type: "Stake", stake: stake };
          connState?.send(msg);
          mining.reset();
        })
        .catch((err) => {
          if (err.code === 4001) alert("You cancelled the transaction");
          console.log("createMatchErr", err);
          mining.reset();
        });
    } else {
      console.log("Ethereum object doesn't exist!");
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

  const checkWhoWon = async () => {
    setMining({ ...mining, status: "mining" });
    // @ts-ignore
    const { ethereum } = window;

    if (ethereum && salt) {
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      const RPSContract = await RPS__factory.connect(contractAddress, signer);

      RPSContract.solve(weapon, salt, {
        gasLimit: 100_000,
      })
        .then(async (tx) => {
          await tx.wait();
          const actualWinner = decideWinnerLocally(weapon, player2Response);
          setWinner(actualWinner);
          if (actualWinner !== "idle") {
            let msg: PeerMsg = { _type: "Winner", player: actualWinner };
            connState?.send(msg);
            msg = { _type: "Player1Weapon", weapon: weapon };
            connState?.send(msg);
            mining.reset();
          }
        })
        .catch((err) => {
          if (err.code === 4001) alert("You cancelled the transaction");
          console.log("checkWhoWon", err);
          mining.reset();
        });
    } else {
      console.log("Ethereum object doesn't exist!");
    }
  };

  const decideWinnerLocally = (
    weapon: Selection,
    player2Response: Selection
  ): Winner => {
    if (win(weapon, player2Response) === "draw") {
      return "no one, a draw";
    } else if (win(weapon, player2Response)) return "P1";
    else return "P2";
  };

  const player2Timedout = async () => {
    setScreenToDisplay("PlayerTimedout");
    //@ts-ignore
    const { ethereum } = window;

    const provider = new ethers.providers.Web3Provider(ethereum);
    const signer = provider.getSigner();

    const contract = RPS__factory.connect(contractAddress, signer);

    setMining({ ...mining, status: "mining" });
    contract
      .j2Timeout()
      .then(async (tx) => {
        await tx.wait();
        mining.reset();
      })
      .catch((err) => {
        if (err.code === 4001) alert("You cancelled the transaction");
        console.log("player2Timedout", err);
        mining.reset();
      });
  };

  // Peer js setup, dinamically as to please NextJS
  useEffect(() => {
    console.log("Trying to reach PeerJS servers");
    const asyncFn = async () => {
      console.log("Trying to create Peer");
      const id = `advancedRPS-${nanoid()}`;
      const peer = await initPeer(id);

      // Save own peer id
      setPeerId(peer.id);

      peer.on("open", () => {});

      peer.on("error", (e) => console.log("ERROR", e));

      peer.on("connection", (conn) => {
        conn.on("error", (e) => console.log("ConnERROR", e));

        conn.on("open", () => {
          conn.send("Linked with Peer 1!");
          const msg: PeerMsg = {
            _type: "Player1Address",
            address: props.accountAddress,
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

            case "Player2Moved":
              setTimer({ ...timer, expired: false, status: "idle" });
              setScreenToDisplay("Player2Decided");
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

  // Decide who is the winner
  useEffect(() => {
    if (player2Response !== 0 && winner === "idle")
      (async () => {
        // Fix loading
        await checkWhoWon();
      })();
    // eslint-disable-next-line
  }, [player2Response]);

  // Finicky code to focus the stakeInput on load
  useEffect(() => {
    if (screenToDisplay === "Player2Connected") {
      const input: HTMLSpanElement | null =
        document.getElementById("stakeInput");
      setTimeout(() => {
        input?.focus();
        if (input) {
          input.innerText = INITIAL_STAKE;
        }
      }, 0);
    }
  }, [screenToDisplay]);

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
            className={"flex-1 flex flex-col w-full   max-w-lg"}
            style={{ flexGrow: 0.5 }}
          >
            <span className={"text-4xl "}>Waiting for Player 2.</span>
            <br />
            {peerId === "" ? (
              <span className={"text-4xl "}>
                Pinging the P2P router. Hold on.
              </span>
            ) : (
              <div className="flex-1 flex justify-center items-center">
                <button
                  onClick={() =>
                    copyToClipBoard(`${BASE_URL}/?peerId=${peerId}`)
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
            style={{ flexGrow: 0.5 }}
          >
            <br />
            {mining.status === "mining" ? (
              <>
                <span className={"text-4xl"}>
                  Deploying contract to the blockchain!
                </span>
                <br />
              </>
            ) : contractAddress === "" ? (
              <>
                <span className={"text-4xl"}>Player 2 has joined.</span>
                <br />
                <span className={"text-4xl"}>
                  How much ETH do you want to bet? Bet{" "}
                  <span
                    id="stakeInput"
                    contentEditable
                    style={{
                      minWidth: "2ch",
                      width: "2ch",
                      paddingLeft: "1px",
                      backgroundColor: "#3D087B",
                      color: "#FFFA83",
                      textDecoration: "underline",
                      border: "none",
                    }}
                    className={"focus:outline-none"}
                    onInput={(e) => setStake(e.currentTarget.innerText)}
                  ></span>{" "}
                  ETH.
                </span>
                <br />
                <span className={"text-4xl"}>Then, pick your weapon.</span>
              </>
            ) : (
              <>
                <span className={"text-4xl"}>
                  Waiting for Player 2&apos;s choice.
                </span>
                <br />
              </>
            )}
          </div>
          {/* This div displays buttons */}
          <div
            className={"flex-1 flex flex-col w-full items-center"}
            style={{ flexGrow: 0.5 }}
          >
            {contractAddress === "" && mining.status === "idle" ? (
              <>
                <WeaponSelector setWeapon={setWeapon} initialWeapon={weapon} />
                <div className="flex-1 flex justify-center items-center">
                  {weapon !== 0 && stake !== "" && parseFloat(stake) > 0 ? (
                    <button
                      onClick={() => {
                        createMatch(stake, weapon, player2Address);
                      }}
                      style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                      className="w-96 h-14 rounded-md text-xl"
                    >
                      Click here to start the match!
                    </button>
                  ) : (
                    ""
                  )}
                </div>
              </>
            ) : (
              <div
                className={
                  "flex-1 flex flex-row w-full justify-center max-w-2xl"
                }
                style={{ flexGrow: 0.5 }}
              >
                <div className={"flex flex-col justify-center items-center "}>
                  <NonInteractableWeapon weapon={weapon} />
                  <br />
                  <div>Your choice</div>
                </div>
                <br />
                <div className={"flex items-center mx-4"}>
                  <span>vs</span>
                </div>
                <br />
                <div className={"flex flex-col justify-center items-center "}>
                  <div>Waiting for Player 2&apos;s response</div>
                </div>
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
              {player2Address === "" ? (
                ""
              ) : (
                <a
                  rel="noreferrer"
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${player2Address}`}
                  className={" px-2 flex flex-row text-xs"}
                  style={{ maxWidth: "fit-content" }}
                >
                  {externalIcon}
                  <span style={{ width: "370px" }}>
                    OPPONENT: {player2Address}
                  </span>
                </a>
              )}
              <br />
              {contractAddress === "" ? (
                ""
              ) : (
                <a
                  rel="noreferrer"
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${contractAddress}`}
                  className={" px-2 flex flex-row text-xs"}
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
              {TimerExpired(timer, winner, player2Timedout)}
            </div>
          </div>
        </div>
      );
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
            {mining.status === "mining" ? (
              <>
                <span className={"text-4xl"}>
                  Mining. Please check your wallet.
                </span>
                <br />
                <span className={"text-4xl"}>
                  Confirm pinging the blockchain to decide winner.
                </span>
              </>
            ) : winner === "idle" ? (
              <>
                <span className={"text-4xl"}>Player 2 has decided!</span>
                <br />
                <span className={"text-4xl"}>
                  Please check your wallet to confirm the end of the match.
                </span>
              </>
            ) : (
              <>
                <span className={"text-4xl"}>
                  The match has ended, thanks for playing!
                </span>
                <br />
                <span className={"text-4xl"}>
                  {winner === "P1"
                    ? "You won! Nice job, and thanks for playing!"
                    : winner === "P2"
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
            ) : player2Response === 0 ? (
              <div className={"flex flex-col justify-center items-center"}>
                <div>Waiting for Player 2&apos;s response</div>
              </div>
            ) : winner === "idle" ? (
              <div className={"flex flex-col justify-center items-center"}>
                <div>Waiting for wallet confirmation</div>
              </div>
            ) : (
              <div className={"flex flex-col justify-center items-center"}>
                <NonInteractableWeapon weapon={player2Response} />
                <br />
                <div>Player 2&apos;s choice</div>
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
              {player2Address === "" ? (
                ""
              ) : (
                <a
                  rel="noreferrer"
                  target="_blank"
                  href={`https://rinkeby.etherscan.io/address/${player2Address}`}
                  className={"px-2 flex flex-row text-xs"}
                  style={{ maxWidth: "fit-content" }}
                >
                  {externalIcon}
                  <span style={{ width: "370px" }}>
                    OPPONENT: {player2Address}
                  </span>
                </a>
              )}
              <br />
              {contractAddress === "" ? (
                ""
              ) : (
                <a
                  rel="noreferrer"
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
              {TimerExpired(timer, winner, player2Timedout)}
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
            <span className={"text-4xl "}>Player 2 timedout.</span>
            <br />
            {mining.status === "mining" ? (
              <span className={"text-4xl "}>
                Sending your stake back to your wallet.
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

const checkIfReadyForMatchCreation = (
  weapon: Selection,
  player2Address: string,
  stake: string,
  peerId: string
) => {
  return weapon === 0 ||
    player2Address === "" ||
    stake === "" ||
    parseFloat(stake) <= 0 ||
    peerId === ""
    ? false
    : true;
};
