import React, { useEffect, useState } from "react";
import SingleWeapon from "./SingleWeapon";

type CircleProps = {
  initialWeapon: number;
  setWeapon: React.Dispatch<React.SetStateAction<number>>;
};
const WeaponSelector = (props: CircleProps) => {
  const IMAGES = [
    "",
    "/rock.png",
    "/paper.png",
    "/scissors.png",
    "/spock.png",
    "/lizard.png",
  ];

  const [selectedWeapon, setSelectedWeapon] = useState<number>(
    props.initialWeapon
  );

  useEffect(() => {
    console.log("Changing weapon to", selectedWeapon, IMAGES[selectedWeapon]);
    props.setWeapon(selectedWeapon);
  }, [selectedWeapon]);

  return (
    <div className={"flex-1 flex flex-row justify-around"}>
      {IMAGES.map((image, index) => {
        if (index === 0) return;
        return (
          <SingleWeapon
            key={index}
            currentWeapon={selectedWeapon}
            setSelectedWeapon={setSelectedWeapon}
            num={index}
            image={image}
          />
        );
      })}
    </div>
  );
};

export default WeaponSelector;
