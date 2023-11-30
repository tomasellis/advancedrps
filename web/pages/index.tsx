import Head from "next/head";
import React, { useEffect, useState } from "react";
import Web3 from "../components/Web3";
import NonWeb3 from "../components/NonWeb3";

export default function Home() {

  const [isWeb3, setIsWeb3] = useState(false)

  const checkIfWeb3 = () => {
    // @ts-ignore
    const { ethereum } = window;

    if (ethereum) {
      setIsWeb3(true)
      console.info('Is web3')
    } else console.info('Is not')
  };

  useEffect(() => checkIfWeb3(), [])

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
          {/* isWeb3 ? <Web3 /> :  */<NonWeb3 />}
        </div>
      </div>
    </div>
  );
}
