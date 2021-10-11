import React from "react";

type SingleWeaponProps = {
  weapon: number;
};

const NonInteractableWeapon = (props: SingleWeaponProps) => {
  const IMAGES = [
    "",
    "/rock.png",
    "/paper.png",
    "/scissors.png",
    "/spock.png",
    "/lizard.png",
  ];

  const boxSize = 120;
  const imageSize = 100;
  const lizardSize = Math.floor(imageSize * (100 / 120)).toString();
  const rockSize = Math.floor(imageSize * (80 / 120)).toString();

  return (
    <div
      className="square"
      style={{
        display: "flex",
        alignContent: "center",
        justifyContent: "center",
        width: `${boxSize.toString()}px`,
        height: `${boxSize.toString()}px`,
        borderRadius: "50%",
        backgroundColor: "#FF005C",
        marginLeft: "10px",
        marginRight: "10px",
        boxShadow: "0px 0px 20px 8px #FF005C",
      }}
    >
      <img
        src={IMAGES[props.weapon]}
        style={{
          transform:
            IMAGES[props.weapon] === "/lizard.png" ? "rotate(-90deg)" : "",
          position: "relative",
          left:
            IMAGES[props.weapon] === "/spock.png"
              ? "5px"
              : IMAGES[props.weapon] === "/paper.png"
              ? "-5px"
              : "",
          width:
            IMAGES[props.weapon] === "/rock.png"
              ? `${rockSize}px`
              : IMAGES[props.weapon] === "/lizard.png"
              ? `${lizardSize}px`
              : `${imageSize}px`,
          height:
            IMAGES[props.weapon] === "/rock.png"
              ? `${rockSize}px`
              : IMAGES[props.weapon] === "/lizard.png"
              ? `${lizardSize}px`
              : `${imageSize}px`,
          alignSelf: "center",
        }}
      />
    </div>
  );
};

export default NonInteractableWeapon;
