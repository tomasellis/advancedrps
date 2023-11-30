import React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/dist/client/router";
import Web3Player1UI from "./Web3Player1UI";
import Web3Player2UI from "./Web3Player2UI";


type Loading = {
    status: boolean;
    msg: string;
    reset: () => void;
    web3: boolean
  };

const Web3 = (props: any) => {

    // General loading screen
    // @ts-ignore
    const [loading, setLoading] = useState<Loading>({
        status: false,
        msg: "",
        reset: () => setLoading({ ...loading, status: false, msg: "" }),
        web3: false
    });
    
    // For queries
    const router = useRouter();

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
    
      // Save the current address
      const [currentAccount, setCurrentAccount] = useState("");

    return <>
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
            <Web3Player1UI accountAddress={currentAccount} />
        ) : (
            <Web3Player2UI
                peerId={router.query.peerId as string}
                currentAccount={currentAccount}
            />
        )}
    </>
}

export default Web3