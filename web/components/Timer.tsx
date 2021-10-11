import React, { useEffect } from "react";
import { useTimer } from "react-timer-hook";

type TimerType = {
  status: "running" | "idle" | "finished";
  defaultTime: Date;
  expired: boolean;
  reset: boolean;
};

const Timer = ({
  expiryTimestamp,
  timerState,
}: {
  expiryTimestamp: Date;
  timerState: {
    timer: TimerType;
    setTimer: React.Dispatch<React.SetStateAction<TimerType>>;
  };
}) => {
  const {
    seconds,
    minutes,
    hours,
    days,
    isRunning,
    start,
    pause,
    resume,
    restart,
  } = useTimer({
    expiryTimestamp,
    onExpire: () => {
      timerState.setTimer({ ...timerState.timer, expired: true });
      console.warn("onExpire called");
    },
  });

  useEffect(() => {
    console.log("Is running", isRunning, seconds, timerState.timer);
    // eslint-disable-next-line
  }, [isRunning]);

  useEffect(() => {
    if (timerState.timer.reset) {
      console.log("Restarting timer");
      timerState.setTimer({ ...timerState.timer, reset: false });
      restart(timerState.timer.defaultTime, true);
    }
    // eslint-disable-next-line
  }, [timerState.timer.reset]);

  return (
    <div style={{ textAlign: "center" }} className={"flex-1 flex flex-col"}>
      <div className={"text-lg"}>
        <span>{minutes}</span>:<span>{seconds}</span> minutes till opponent
        timeout
      </div>
    </div>
  );
};

export default Timer;
