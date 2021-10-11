import React, { useEffect, useState } from "react";

type SingleWeaponProps = {
  num: number;
  image: string;
  currentWeapon: number;
  setSelectedWeapon: React.Dispatch<React.SetStateAction<number>>;
};
const SingleWeapon = (props: SingleWeaponProps) => {
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (props.currentWeapon === props.num) {
      props.setSelectedWeapon(props.num);
      return setSelected(true);
    }
    return setSelected(false);
    // eslint-disable-next-line
  }, [props.currentWeapon]);

  const boxSize = 120;
  const imageSize = 100;
  const lizardSize = Math.floor(imageSize * (100 / 120)).toString();
  const rockSize = Math.floor(imageSize * (80 / 120)).toString();

  return (
    <div
      onClick={() => {
        props.setSelectedWeapon(props.num);
      }}
      className={"singleWeapon"}
      style={{
        display: "flex",
        alignContent: "center",
        justifyContent: "center",
        width: `${boxSize.toString()}px`,
        height: `${boxSize.toString()}px`,
        borderRadius: "50%",
        backgroundColor: selected === true ? "#FF005C" : "",
        marginLeft: "10px",
        marginRight: "10px",
        boxShadow: selected === true ? "0px 0px 20px 8px #FF005C" : "",
        opacity: props.currentWeapon === 0 ? 1 : selected === true ? 1 : 0.5,
      }}
    >
      <img
        src={props.image}
        style={{
          transform: props.image === "/lizard.png" ? "rotate(-90deg)" : "",
          position: "relative",
          left:
            props.image === "/spock.png"
              ? "5px"
              : props.image === "/paper.png"
              ? "-5px"
              : "",
          width:
            props.image === "/rock.png"
              ? `${rockSize}px`
              : props.image === "/lizard.png"
              ? `${lizardSize}px`
              : `${imageSize}px`,
          height:
            props.image === "/rock.png"
              ? `${rockSize}px`
              : props.image === "/lizard.png"
              ? `${lizardSize}px`
              : `${imageSize}px`,
          alignSelf: "center",
        }}
      />
    </div>
  );
};

export default SingleWeapon;
