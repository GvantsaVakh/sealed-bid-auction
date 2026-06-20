import { useEffect, useMemo, useState } from "react";
import { CONTRACT_ADDRESS, requireContractAddress } from "./config";
import { connectWallet, getAuctionContract, shortAddress } from "./utils/contract";
import { decryptAuctionResults, encryptBid, getFheInstance } from "./utils/fhe";

type AuctionResult = {
  highestBid: string;
  secondHighestBid: string;
  winnerId: string;
  winnerAddress: string;
};

function App() {
  const [account, setAccount] = useState("");
  const [itemName, setItemName] = useState("-");
  const [owner, setOwner] = useState("-");
  const [isActive, setIsActive] = useState(false);
  const [auctionEnded, setAuctionEnded] = useState(false);
  const [bidCount, setBidCount] = useState("0");
  const [bidAmount, setBidAmount] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuctionResult | null>(null);

  const contractAddress = useMemo(() => CONTRACT_ADDRESS, []);

  function addLog(message: string) {
    setLogs((previous) => [`${new Date().toLocaleTimeString()} — ${message}`, ...previous]);
  }

  async function refreshAuctionState() {
    try {
      const address = requireContractAddress();
      const contract = await getAuctionContract(address);

      const [name, auctionOwner, active, ended, count] = await Promise.all([
        contract.itemName(),
        contract.owner(),
        contract.isActive(),
        contract.auctionEnded(),
        contract.bidCount(),
      ]);

      setItemName(name);
      setOwner(auctionOwner);
      setIsActive(active);
      setAuctionEnded(ended);
      setBidCount(count.toString());
    } catch (error) {
      addLog(`Could not refresh auction state: ${String(error)}`);
    }
  }

  async function handleConnect() {
    try {
      setLoading(true);
      const connectedAccount = await connectWallet();
      setAccount(connectedAccount);
      addLog(`Wallet connected: ${shortAddress(connectedAccount)}`);

      addLog("Initializing FHE SDK...");
      await getFheInstance();
      addLog("FHE SDK ready.");

      await refreshAuctionState();
    } catch (error) {
      addLog(`Connection failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitBid() {
    try {
      setLoading(true);

      if (!account) {
        throw new Error("Connect wallet first.");
      }

      const address = requireContractAddress();
      const parsedBid = Number(bidAmount);

      if (!Number.isInteger(parsedBid) || parsedBid <= 0) {
        throw new Error("Enter a positive integer bid.");
      }

      addLog(`Preparing private bid: ${parsedBid}`);
      addLog("Encrypting bid locally in the browser...");

      const encryptedBid = await encryptBid(address, account, parsedBid);

      addLog(`Encrypted bid handle created: ${String(encryptedBid.handle)}`);
      addLog("Submitting encrypted bid transaction...");

      const contract = await getAuctionContract(address);
      const tx = await contract.submitBid(encryptedBid.handle, encryptedBid.inputProof);

      addLog(`Transaction sent: ${tx.hash}`);

      await tx.wait();

      addLog("Encrypted bid submitted successfully.");
      setBidAmount("");

      await refreshAuctionState();
    } catch (error) {
      addLog(`Bid failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalizeAuction() {
    try {
      setLoading(true);

      const address = requireContractAddress();
      const contract = await getAuctionContract(address);

      addLog("Finalizing auction...");
      const tx = await contract.endAuction();

      addLog(`Finalize transaction sent: ${tx.hash}`);

      await tx.wait();

      addLog("Auction finalized.");
      await refreshAuctionState();
    } catch (error) {
      addLog(`Finalize failed: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecryptResult() {
    try {
      setLoading(true);

      if (!account) {
        throw new Error("Connect wallet first.");
      }

      const address = requireContractAddress();
      const contract = await getAuctionContract(address);

      addLog("Reading encrypted highest bid, Vickrey price, and winner id...");
      const encryptedHighestBid = await contract.getHighestBid();
      const encryptedSecondHighestBid = await contract.getSecondHighestBid();
      const encryptedWinnerId = await contract.getEncryptedWinnerId();

      addLog("Requesting owner/user decryption signature in MetaMask...");

      const decrypted = await decryptAuctionResults(
        address,
        encryptedHighestBid,
        encryptedSecondHighestBid,
        encryptedWinnerId,
        account,
      );

      const winnerAddress = await contract.bidderById(decrypted.winnerId);

      setResult({
        highestBid: decrypted.highestBid.toString(),
        secondHighestBid: decrypted.secondHighestBid.toString(),
        winnerId: decrypted.winnerId.toString(),
        winnerAddress,
      });

      addLog("Auction result decrypted successfully.");
    } catch (error) {
      addLog(`Decrypt failed: ${String(error)}`);
      addLog("Reminder: only an address allowed by the contract ACL can decrypt the final result.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (contractAddress && contractAddress !== "0xYourDeployedSealedBidAuctionAddress") {
      void refreshAuctionState();
    }
  }, [contractAddress]);

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">FHE-powered sealed-bid protocol</p>
        <h1>Confidential Vickrey Auction</h1>
        <p className="subtitle">
          Bids are encrypted before they go on-chain. The smart contract privately computes the highest bid, the
          second-highest bid, and the winner. The winner pays the second-highest price.
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Auction Info</h2>     

          <div className="infoRow">
            <span>Item</span>
            <strong>{itemName}</strong>
          </div>

          <div className="infoRow">
            <span>Type</span>
            <strong>Vickrey / second-price</strong>
          </div>

          <div className="infoRow">
            <span>Status</span>
            <strong className={isActive ? "green" : "red"}>{isActive ? "Active" : "Not active"}</strong>
          </div>

          <div className="infoRow">
            <span>Finalized</span>
            <strong>{auctionEnded ? "Yes" : "No"}</strong>
          </div>

          <div className="infoRow">
            <span>Bid count</span>
            <strong>{bidCount}</strong>
          </div>

          <div className="infoRow">
            <span>Owner</span>
            <strong>{owner !== "-" ? shortAddress(owner) : "-"}</strong>
          </div>

          <div className="infoRow">
            <span>Contract</span>
            <strong>{contractAddress ? shortAddress(contractAddress) : "Missing .env"}</strong>
          </div>

          <button onClick={refreshAuctionState} disabled={loading}>
            Refresh state
          </button>
        </div>

        <div className="card">
          <h2>Wallet</h2>

          {account ? (
            <p>
              Connected as <strong>{shortAddress(account)}</strong>
            </p>
          ) : (
            <p>Connect MetaMask on Sepolia to submit encrypted bids.</p>
          )}

          <button onClick={handleConnect} disabled={loading}>
            {account ? "Reconnect Wallet" : "Connect Wallet"}
          </button>
        </div>

        <div className="card">
          <h2>Submit Private Bid</h2>

          <p className="muted">
            The number you enter is encrypted locally. The chain receives only an encrypted handle and proof.
          </p>

          <input
            value={bidAmount}
            onChange={(event) => setBidAmount(event.target.value)}
            placeholder="Example: 77"
            inputMode="numeric"
          />

          <button onClick={handleSubmitBid} disabled={loading || !account || !isActive}>
            Encrypt & Submit Bid
          </button>
        </div>

        <div className="card">
          <h2>Finalize / Reveal</h2>

          <p className="muted">
            After the deadline, finalize the auction. Then the allowed owner account can decrypt the result.
          </p>

          <button onClick={handleFinalizeAuction} disabled={loading || auctionEnded}>
            Finalize Auction
          </button>

          <button onClick={handleDecryptResult} disabled={loading || !auctionEnded}>
            Decrypt Result
          </button>
        </div>
      </section>

      {result && (
        <section className="card result">
          <h2>Final Result</h2>

          <div className="resultGrid">
            <div>
              <span>Highest bid</span>
              <strong>{result.highestBid}</strong>
            </div>

            <div>
              <span>Vickrey price</span>
              <strong>{result.secondHighestBid}</strong>
            </div>

            <div>
              <span>Winner id</span>
              <strong>{result.winnerId}</strong>
            </div>

            <div>
              <span>Winner address</span>
              <strong>{shortAddress(result.winnerAddress)}</strong>
            </div>
          </div>

          <p className="success">
            Winner pays {result.secondHighestBid}, not {result.highestBid}.
          </p>
        </section>
      )}

      <section className="card logs">
        <h2>Event Log</h2>

        {logs.length === 0 ? (
          <p className="muted">Logs will appear here...</p>
        ) : (
          <ul>
            {logs.map((log, index) => (
              <li key={`${log}-${index}`}>{log}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default App;