const ethers = require("ethers");
const provider = new ethers.WebSocketProvider(
  // "wss://sepolia.infura.io/ws/v3/69f016cc061b438e918250adc2b66416"
  "wss://sepolia.gateway.tenderly.co"
);

interface TransactionSignature {
  _type: "signature";
  networkV?: string | null;
  r: string;
  s: string;
  v: number;
}

// Main interface for Ethereum Transaction Response
interface EthereumTransactionResponse {
  _type: "TransactionResponse";
  accessList: any[] | null;
  blockNumber: number;
  blockHash: string;
  blobVersionedHashes: string[] | null;
  chainId: string;
  data: string;
  from: string;
  gasLimit: string;
  gasPrice: string;
  hash: string;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  maxFeePerBlobGas: string | null;
  nonce: number;
  signature: TransactionSignature;
  to: string;
  index: number;
  type: number;
  value: string;
}

//utils
const mockUserData = [
  {
    id: 1,
    username: "User A",
    address: "0x2C57E373624D66B7a2E000A91E12ED6B865D57BA",
    email: "usera@example.com",
    balance: "1.5",
    transactions: [],
    createdAt: "2024-01-15T10:30:00Z",
    isActive: true,
  },
  {
    id: 2,
    username: "User B",
    address: "0xE90ACFD806d52c857AD0a2705D49A4F846ACfDAE",
    email: "userb@example.com",
    balance: "2.8",
    transactions: [],
    createdAt: "2024-01-20T14:45:00Z",
    isActive: true,
  },
  {
    id: 3,
    username: "User C",
    address: "0xB3988b8a447C154112D7D58119eB4f5Ec2193669",
    email: "userc@example.com",
    balance: "0.25",
    transactions: [],
    createdAt: "2024-02-05T09:15:00Z",
    isActive: false,
  },
  {
    id: 4,
    username: "User D",
    address: "0x0f95B9495423589b6fD5aEf958C873b629C4B788",
    email: "userc@example.com",
    balance: "0.25",
    transactions: [],
    createdAt: "2024-02-05T09:15:00Z",
    isActive: false,
  },
];

// Token transfer detection utilities
class TokenTransferDetector {
  // ERC-20 transfer function signature: transfer(address,uint256)
  private static ERC20_TRANSFER_SIGNATURE = "0xa9059cbb";

  // ERC-20 transferFrom function signature: transferFrom(address,address,uint256)
  private static ERC20_TRANSFER_FROM_SIGNATURE = "0x23b872dd";

  static isEthTransfer(tx: EthereumTransactionResponse): boolean {
    // ETH transfer: has value > 0 and either no data or simple data
    return tx.value !== "0" && (tx.data === "0x" || tx.data.length <= 10);
  }

  static isERC20Transfer(tx: EthereumTransactionResponse): boolean {
    // ERC-20 transfer: data starts with transfer signature and has correct length
    return (
      tx.data.startsWith(this.ERC20_TRANSFER_SIGNATURE) &&
      tx.data.length === 138
    ); // 4 + 32 + 32 + 32 bytes
  }

  static isERC20TransferFrom(tx: EthereumTransactionResponse): boolean {
    // ERC-20 transferFrom: data starts with transferFrom signature
    return (
      tx.data.startsWith(this.ERC20_TRANSFER_FROM_SIGNATURE) &&
      tx.data.length === 202
    ); // 4 + 32 + 32 + 32 + 32 bytes
  }

  static isTokenTransaction(tx: EthereumTransactionResponse): boolean {
    // Any transaction that involves tokens
    return (
      this.isERC20Transfer(tx) ||
      this.isERC20TransferFrom(tx) ||
      (tx.data.length > 10 && tx.to !== null)
    ); // Contract interaction
  }

  static decodeERC20Transfer(tx: EthereumTransactionResponse): {
    tokenContract: string;
    to: string;
    amount: string;
  } | null {
    if (!this.isERC20Transfer(tx)) return null;

    const data = tx.data.slice(2); // Remove 0x prefix
    const signature = data.slice(0, 8); // First 4 bytes (8 hex chars)
    const toAddress = "0x" + data.slice(32, 72); // Next 32 bytes, take last 20
    const amount = "0x" + data.slice(72, 136); // Next 32 bytes

    return {
      tokenContract: tx.to,
      to: toAddress,
      amount: amount,
    };
  }

  static decodeERC20TransferFrom(tx: EthereumTransactionResponse): {
    tokenContract: string;
    from: string;
    to: string;
    amount: string;
  } | null {
    if (!this.isERC20TransferFrom(tx)) return null;

    const data = tx.data.slice(2);
    const fromAddress = "0x" + data.slice(32, 72);
    const toAddress = "0x" + data.slice(96, 136);
    const amount = "0x" + data.slice(160, 200);

    return {
      tokenContract: tx.to,
      from: fromAddress,
      to: toAddress,
      amount: amount,
    };
  }

  static getTransferType(tx: EthereumTransactionResponse): string {
    if (this.isEthTransfer(tx)) return "ETH_TRANSFER";
    if (this.isERC20Transfer(tx)) return "ERC20_TRANSFER";
    if (this.isERC20TransferFrom(tx)) return "ERC20_TRANSFER_FROM";
    if (tx.data.length > 10) return "CONTRACT_INTERACTION";
    return "UNKNOWN";
  }
}

function getUserData(address: string | null) {
  if (!address) {
    return undefined;
  }

  return mockUserData.find(
    (userData) => userData.address.toLowerCase() === address.toLowerCase()
  );
}

const getTx = () => {
  try {
    provider.on("block", async (blockNumber: number) => {
      console.log("New Block:", blockNumber);

      try {
        const txHistory = await provider.getBlock(blockNumber, true);

        if (!txHistory?.transactions?.length) {
          console.log("No transactions found in this block.");
          return;
        }

        // Process transactions in parallel for better performance
        const transactionPromises = txHistory.transactions.map(
          async (tx: any) => {
            const txHash = typeof tx === "string" ? tx : tx.hash;

            try {
              const transactionData: EthereumTransactionResponse =
                await provider.getTransaction(txHash);
              if (TokenTransferDetector.isERC20Transfer(transactionData)) {
                const transferDetails =
                  TokenTransferDetector.decodeERC20Transfer(transactionData);
                if (transferDetails) {
                  const tokenRecipientData = getUserData(transferDetails.to);
                  if (tokenRecipientData) {
                    console.log(
                      "Found ERC-20 transfer to monitored address:",
                      tokenRecipientData.address
                    );
                    logTxDetails(transactionData);
                  }
                }
              }
              // Check if transaction is to any of our monitored addresses
              const userData = getUserData(transactionData.to);
              if (userData) {
                console.log(
                  "Found transaction to monitored address:",
                  userData.address
                );
                logTxDetails(transactionData);
              }
            } catch (error) {
              // console.log(`Error fetching transaction ${txHash}:`, error);
            }
          }
        );

        // Wait for all transaction processing to complete
        await Promise.allSettled(transactionPromises);
      } catch (blockError) {
        console.log("Error fetching block data:", blockError);
      }
    });
  } catch (error) {
    console.log("Error setting up block listener:", error);
  }
};

const logTxDetails = (tx: EthereumTransactionResponse) => {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 TRANSACTION DETAILS");
  console.log("=".repeat(60));

  // Basic transaction info - always shown
  console.log(`🔗 Hash: ${tx.hash}`);
  console.log(`📦 Block Number: ${tx.blockNumber}`);
  console.log(`📦 Block Hash: ${tx.blockHash}`);
  console.log(`📍 From Address: ${tx.from}`);
  console.log(`📍 To Address: ${tx.to}`);
  console.log(`🌐 Chain ID: ${tx.chainId}`);
  console.log(`📊 Nonce: ${tx.nonce}`);
  console.log(`📊 Transaction Index: ${tx.index}`);

  // Gas information
  console.log(`⛽ Gas Limit: ${tx.gasLimit}`);
  console.log(`⛽ Gas Price: ${tx.gasPrice}`);
  if (tx.maxFeePerGas) console.log(`⛽ Max Fee Per Gas: ${tx.maxFeePerGas}`);
  if (tx.maxPriorityFeePerGas)
    console.log(`⛽ Max Priority Fee Per Gas: ${tx.maxPriorityFeePerGas}`);
  if (tx.maxFeePerBlobGas)
    console.log(`⛽ Max Fee Per Blob Gas: ${tx.maxFeePerBlobGas}`);

  // ETH Transfer
  if (TokenTransferDetector.isEthTransfer(tx)) {
    console.log("💰 ETH TRANSFER DETECTED");
    console.log(`💸 Amount: ${tx.value} wei`);
    console.log(`💸 Amount in ETH: ${parseInt(tx.value) / 1e18} ETH`);
    console.log(`👤 From: ${tx.from}`);
    console.log(`👤 To: ${tx.to}`);
  }

  //   // ERC-20 Transfer
  if (TokenTransferDetector.isERC20Transfer(tx)) {
    console.log("🪙 ERC-20 TRANSFER DETECTED");
    const transferDetails = TokenTransferDetector.decodeERC20Transfer(tx);
    if (transferDetails) {
      console.log(`🏦 Token Contract: ${transferDetails.tokenContract}`);
      console.log(`👤 To Address: ${transferDetails.to}`);
      console.log(`💰 Amount (hex): ${transferDetails.amount}`);
      // console.log(
      //   `💰 Amount (decimal): ${parseInt(transferDetails.amount, 16)}`
      // );
      console.log(
        `💰 Amount (decimal): ${BigInt(transferDetails.amount).toString()}`
      );
    }
  }

  //   // ERC-20 TransferFrom
  if (TokenTransferDetector.isERC20TransferFrom(tx)) {
    console.log("🔄 ERC-20 TRANSFER_FROM DETECTED");
    const transferDetails = TokenTransferDetector.decodeERC20TransferFrom(tx);
    if (transferDetails) {
      console.log(`🏦 Token Contract: ${transferDetails.tokenContract}`);
      console.log(`👤 From Address: ${transferDetails.from}`);
      console.log(`👤 To Address: ${transferDetails.to}`);
      console.log(`💰 Amount (hex): ${transferDetails.amount}`);
      console.log(
        `💰 Amount (decimal): ${parseInt(transferDetails.amount, 16)}`
      );
    }
  }
};

const main = async () => {
  getTx();
};

main().catch((error) => {
  console.error("Error in main execution:", error);
});
