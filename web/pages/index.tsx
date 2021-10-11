import Head from "next/head";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/dist/client/router";
import Player1UI from "../components/Player1UI";
import Player2UI from "../components/Player2UI";

type Loading = {
  status: boolean;
  msg: string;
  reset: () => void;
};

export default function Home() {
  const checkIfWalletIsConnected = async () => {
    // @ts-ignore
    const { ethereum } = window;

    setLoading({
      ...loading,
      status: true,
      msg: "Checking for authorized wallets...",
    });

    if (ethereum) {
      ethereum.on("accountsChanged", function (accounts: any) {
        if (accounts[0] === undefined) {
          setCurrentAccount("");
        }
      });

      console.log("Make sure you have metamask!");

      const accounts = await ethereum.request({ method: "eth_accounts" });

      if (accounts.length !== 0) {
        const account = accounts[0];
        setCurrentAccount(account);
      } else {
        console.log("No authorized account found");
      }

      loading.reset();
      return;
    } else {
      loading.reset();
      return window.alert("Please install Metamask to get the full experience");
    }
  };

  const connectWallet = async () => {
    setLoading({ ...loading, status: true, msg: "Connecting your wallet..." });
    try {
      // @ts-ignore
      const { ethereum } = window;

      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }

      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      setCurrentAccount(accounts[0]);

      loading.reset();
    } catch (error) {
      loading.reset();
      console.log(error);
    }
  };

  // Check wallet once when starting and get account
  useEffect(() => {
    checkIfWalletIsConnected();
    // eslint-disable-next-line
  }, []);

  // For queries
  const router = useRouter();

  // Save the current address
  const [currentAccount, setCurrentAccount] = useState("");

  // General loading screen
  const [loading, setLoading] = useState<Loading>({
    status: false,
    msg: "",
    reset: () => setLoading({ ...loading, status: false, msg: "" }),
  });

  return (
    <div style={{ backgroundColor: "#11052C" }} className="flex flex-grow">
      <Head>
        <title>Advanced RPS</title>
        <meta
          name="description"
          content="A site where friendships are ruined"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Righteous&display=swap"
          rel="stylesheet"
        ></link>
      </Head>
      <div
        id="mainDisplay"
        className="flex flex-row flex-nowrap w-screen h-screen"
      >
        <div
          id="leftDisplay"
          className="flex-1 flex flex-col flex-grow"
          style={{ maxWidth: "40%", fontFamily: "Righteous" }}
        >
          <div
            className={"text-8xl relative flex-1 flex flex-col flex-nowrap"}
            style={{
              marginTop: "4rem",
              marginLeft: "6rem",
              color: "#FFFA83",
            }}
          >
            <span>Rock</span>
            <span>Paper</span>
            <span>Scissors</span>
            <span>Lizard</span>
            <span>Spock</span>
          </div>
        </div>
        <div
          id="rightDisplay"
          style={{ backgroundColor: "#3D087B", fontFamily: "Righteous" }}
          className="flex-1 flex flex-col h-full w-full"
        >
          {loading.status === true ? (
            <div
              className={
                "relative flex-1 flex flex-col flex-nowrap items-center"
              }
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
                <span className={"text-4xl"}>
                  Now connecting to your wallet.
                </span>
                <br />
                <span className={"text-4xl"}>
                  Please check to confirm connection.
                </span>
              </div>
            </div>
          ) : currentAccount === "" ? (
            <div className="flex-1 flex justify-center items-center">
              <button
                onClick={() => connectWallet()}
                style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                className="w-96 h-14 rounded-md text-xl"
              >
                Click here to connect your wallet!
              </button>
            </div>
          ) : router.query.peerId === undefined ? (
            <Player1UI accountAddress={currentAccount} />
          ) : (
            <Player2UI
              peerId={router.query.peerId as string}
              currentAccount={currentAccount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
