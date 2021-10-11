import Peer from "peerjs";

const initPeer = async (id?: string): Promise<Peer> => {
  const Peer = (await import("peerjs")).default;

  return new Promise((resolve, reject) => {
    const peer = new Peer(id);
    peer.on("error", (err) => {
      console.error(err);
      reject(`Could not create peer ${err.toString()}`);
    });

    peer.on("open", (_) => {
      resolve(peer);
    });
  });
};

export default initPeer;
