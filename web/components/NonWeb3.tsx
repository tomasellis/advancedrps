import React from "react";
import { useEffect, useState } from "react";
import Player1UI from "./Player1UI";
import Player2UI from "./Player2UI";
import { useRouter } from "next/dist/client/router";


type Loading = {
    status: boolean;
    msg: string;
    reset: () => void;
    start: boolean
};

const NonWeb3 = (props: any) => {

    // General loading screen
    // @ts-ignore
    const [loading, setLoading] = useState<Loading>({
        status: false,
        msg: "",
        reset: () => setLoading({ ...loading, status: false, msg: "" }),
        start: false
    });

    // For queries
    const router = useRouter();

    // Start game
    const startGame = () => {
        setLoading({ ...loading, start: true })
    }

    return <>
        {router.query.peerId ? (
            <Player2UI
                peerId={router.query.peerId as string}
            />) : loading.start === false ? (
                <div className="flex-1 flex justify-center items-center">
                    <button
                        onClick={() => setLoading({ ...loading, start: true })}
                        style={{ color: "#FFFA83", backgroundColor: "#FF005C" }}
                        className="w-96 h-14 rounded-md text-xl"
                    >
                        Let&apos;s start!
                    </button>
                </div>
            ) : (<Player1UI />)






            /* loading.status === true ? (
                <div
                    className={
                        "relative flex-1 flex flex-col flex-nowrap items-center"
                    }
                    style={{
                        paddingTop: "4rem",
                        color: "#FFFA83",
                    }}
                >
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
                */
        }









    </>
}

export default NonWeb3