import hre, { ethers } from "hardhat";
import { RPS__factory } from "../typechain";

const CONTRACT_ADDRESS = "";
const RPC_PROVIDER_URL = "";
const SALT = "idk";

const main = async () => {
  // Get two addresses
  const [owner, randomPerson] = await hre.ethers.getSigners();
  console.log("INITIAL BALANCE 1", await owner.getBalance());
  console.log("INITIAL BALANCE 2", await randomPerson.getBalance());

  const RPSFactory = await hre.ethers.getContractFactory("RPS");
  const HasherFactory = await hre.ethers.getContractFactory("Hasher");

  // J1 hash
  const HasherContract = await HasherFactory.deploy();
  console.log("HASHER CONTRACT ADDRESS ----", HasherContract.address);

  const hash = await HasherContract.hash(1, 1);
  const RPSContract = await RPSFactory.deploy(hash, randomPerson.address, {
    value: 1,
  });
  console.log("RPS CONTRACT ADDRESS ----", RPSContract.address);
  console.log("RPS STAKE----", await RPSContract.stake());

  // Now p2 plays and pays
  // const player2Hash = solidityKeccak256(["uint8", "uint256"], [2, 1]);
  await RPSContract.connect(randomPerson).play(2, {
    value: 1,
  });

  const timeouts = RPSContract.TIMEOUT();
  console.log("If someone takes longer than %s", await timeouts);

  await RPSContract.solve(1, 1);

  console.log("FINAL BALANCE 1", await owner.getBalance());
  console.log("FINAL BALANCE 2", await randomPerson.getBalance());
};

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

runMain();
