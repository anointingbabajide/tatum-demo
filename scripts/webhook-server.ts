const express = require("express");
import { Request, Response } from "express";

const app = express();
app.use(express.json());

const TOKEN_TYPE = [
  {
    chain: "SEPOLA",
    TOKEN_NAME: "USDT",
    contractAddress: "0x5C95260eBD1dD21547528E73dc601d74B2793e0D",
  },
  {
    chain: "SEPOLIA",
    TOKEN_NAME: "USDC",
    contractAddress: "0x387d687B9574E93aCCEF1c272ce0D77381305eC3",
  },
  {
    chain: "TRON",
    TOKEN_NAME: "USDT",
    contractAddress: "0x5C95260eBD1dD21547528E73dc601d74B2793e0Y",
  },
];

// Type definitions for Tatum webhooks
interface TatumWebhookNotification {
  address: string;
  amount: string;
  asset: string;
  tokeName: string;
  blockNumber: number;
  counterAddress: string;
  txId: string;
  type: "native" | "token";
  chain: string;
  subscriptionType: "ADDRESS_EVENT";
}

interface WebhookResponse {
  message: string;
  timestamp: string;
  processed?: boolean;
}

interface HealthResponse {
  status: string;
  timestamp: string;
}

// Basic webhook endpoint to receive Tatum notifications
app.post("/webhook", (req: Request, res: Response<WebhookResponse>) => {
  console.log("\n" + "=".repeat(50));
  console.log("🎯 WEBHOOK NOTIFICATION RECEIVED!");
  console.log("=".repeat(50));
  console.log("📅 Timestamp:", new Date().toISOString());
  console.log("📋 Body:", JSON.stringify(req.body, null, 2));
  const notification: TatumWebhookNotification = req.body;
  try {
    // Check if this is a Tatum ADDRESS_EVENT notification
    if (isTatumAddressEvent(req.body)) {
      console.log("\n✅ Valid Tatum ADDRESS_EVENT detected!");

      // Process the transaction notification
      logTransactionDetails(notification);

      res.status(200).json({
        message: "Tatum notification received and logged",
        timestamp: new Date().toISOString(),
        processed: true,
      });
    } else {
      console.log("\n⚠️  Unknown webhook format");
      logTransactionDetails(notification);
      res.status(200).json({
        message: "Webhook received but format not recognized",
        timestamp: new Date().toISOString(),
        processed: false,
      });
    }
  } catch (error) {
    console.error("\n❌ Error processing webhook:", error);
    res.status(500).json({
      message: "Error processing webhook",
      timestamp: new Date().toISOString(),
      processed: false,
    });
  }
});

// Check if the payload is a Tatum ADDRESS_EVENT
function isTatumAddressEvent(
  payload: any
): payload is TatumWebhookNotification {
  return (
    payload &&
    typeof payload.address === "string" &&
    typeof payload.amount === "string" &&
    typeof payload.asset === "string" &&
    typeof payload.txId === "string" &&
    payload.subscriptionType === "ADDRESS_EVENT"
  );
}

function getAssetName(asset: string) {
  const assetFormmated = asset.toLowerCase();

  const assetName = TOKEN_TYPE.find((name) => {
    return name.contractAddress.toLowerCase() === assetFormmated;
  });
  if (!assetName) return "Unknown Token";
  return assetName.TOKEN_NAME;
}

// Log transaction details
function logTransactionDetails(notification: TatumWebhookNotification) {
  const {
    address,
    amount,
    asset,
    counterAddress,
    txId,
    blockNumber,
    type,
    chain,
  } = notification;

  console.log("\n" + "-".repeat(30));
  console.log("🔍 TRANSACTION DETAILS:");
  console.log("-".repeat(30));
  console.log(`💰 Amount: ${amount} ${asset}`);
  console.log(`📍 Address: ${address}`);
  console.log(`📍 Token Name: ${getAssetName(asset as string)}`);
  console.log(`🔗 Counter Address: ${counterAddress} `);
  console.log(`📊 Type: ${type.toUpperCase()}`);
  console.log(`🌐 Chain: ${chain}`);
  console.log(`📦 Block Number: ${blockNumber}`);
  console.log(`🔗 Transaction Hash: ${txId}`);

  // Generate explorer URL
  const explorerUrl = generateExplorerUrl(txId, chain);
  console.log(`🌍 Explorer URL: ${explorerUrl}`);

  // Determine direction
  const direction = parseFloat(amount) > 0 ? "INCOMING" : "OUTGOING";
  console.log(`📊 Direction: ${direction}`);

  console.log("-".repeat(30));
}

// Generate blockchain explorer URL
function generateExplorerUrl(txHash: string, chain: string): string {
  if (chain.includes("sepolia")) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  } else if (chain.includes("mainnet")) {
    return `https://etherscan.io/tx/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}

// Health check endpoint
app.get("/health", (req: Request, res: Response<HealthResponse>) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint to simulate a webhook
app.post("/test", (req: Request, res: Response) => {
  console.log("\n🧪 TESTING WEBHOOK WITH SAMPLE DATA...");

  const sampleNotification: TatumWebhookNotification = {
    address: "0xff5ded1d122a0c2279fcf65b42f2ff6d1afebae4",
    amount: "0.001",
    asset: "ETH",
    blockNumber: 2913059,
    counterAddress: "0x690B9A9E9aa1C9dB991C7721a92d351Db4FaC990",
    txId: "0x062d236ccc044f68194a04008e98c3823271dc26160a4db9ae9303f9ecfc7bf6",
    type: "native",
    tokeName: "usdt",
    chain: "ethereum-sepolia",
    subscriptionType: "ADDRESS_EVENT",
  };

  logTransactionDetails(sampleNotification);

  res.json({
    message: "Test webhook processed successfully",
    sampleData: sampleNotification,
    timestamp: new Date().toISOString(),
  });
});

// Start the server
const PORT: number = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Basic Webhook Server running on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`\nℹ️  To test the webhook:`);
  console.log(`   curl -X POST http://localhost:${PORT}/test`);
  console.log(`\n⏳ Ready to receive Tatum notifications...`);
});
