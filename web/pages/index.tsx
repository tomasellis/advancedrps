import Head from "next/head";
import React, { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import { useRouter } from "next/dist/client/router";
import Player1UI from "./components/Player1UI";
import Player2UI from "./components/Player2UI";

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
        console.log("Found an authorized account:", account);
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

      console.log("Connected", accounts[0]);

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
    <div className={styles.container}>
      <Head>
        <title>Advanced RPS</title>
        <meta
          name="description"
          content="A site where friendships are ruined"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        {loading.status === true ? (
          <div>{loading.msg}</div>
        ) : currentAccount === "" ? (
          <div>
            <button onClick={() => connectWallet()}>
              💵 - Click here to connect your wallet!
            </button>
          </div>
        ) : router.query.peerId === undefined ? (
          <Player1UI />
        ) : (
          <Player2UI
            peerId={router.query.peerId as string}
            currentAccount={currentAccount}
          />
        )}
      </div>
    </div>
  );
}

type Loading = {
  status: boolean;
  msg: string;
  reset: () => void;
};
