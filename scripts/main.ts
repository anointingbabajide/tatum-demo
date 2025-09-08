import axios, { AxiosHeaders, AxiosResponse } from "axios";

interface HDWalletResponse {
  xpub: string;
  mnemonic: string;
}

// configuration
class TatumConfig {
  static readonly API_KEY =
    "t-68bec61797f0a5524832a6a2-8688c8c7da7e42298b12a49b";
  static readonly CHAIN = "ethereum";
  static readonly CHAIN_TYPE = "ethereum-sepolia";
  static readonly WEBHOOK_URL = "https://2ade898ba609.ngrok-free.app/webhook";
  static readonly SUB_URL = "https://api.tatum.io/v4/subscription";
  static readonly BASE_URL = "https://api.tatum.io/v3";
  static readonly V4_BASE_URL = "https://api.tatum.io/v4";
  static readonly WALLET_DATA_FILE = "wallet_data.json";
  static readonly TEST_ADDRESS = "0x29772ce1cb7c1cefcae07fa7f03dc7d2de8cba83";
}

//Generate HD wallet
const GenerateMasterWallet = async (): Promise<
  HDWalletResponse | undefined
> => {
  console.log("Generating Master Wallet");
  try {
    const response = await axios.get(
      `${TatumConfig.BASE_URL}/${TatumConfig.CHAIN}/wallet?${TatumConfig.CHAIN_TYPE}`,
      {
        headers: {
          accept: "application/json",
          "x-testnet-type": `${TatumConfig.CHAIN_TYPE}`,
          "x-api-key": `${TatumConfig.API_KEY}`,
        },
      }
    );

    const data = response.data;
    console.log("The Admin Wallet:", data);
    return data;
  } catch (error: unknown) {
    console.log("Error while generating master wallet:", error);
  }
};

//Generate Unique Address based on index(start with 0)
const GenerateAddress = async (): Promise<string[] | undefined> => {
  try {
    console.log("Using the Already generated Master Account");
    const walletData = await GenerateMasterWallet();
    if (!walletData?.xpub) {
      console.log("Failed to get xpub from master wallet");
      return undefined;
    }
    console.log("Generating 10 Addresses");

    const addresses: string[] = [];

    let index = 0;
    while (index < 10) {
      try {
        console.log("Generating wallet at index:", index);

        const response = await axios.get(
          `${TatumConfig.BASE_URL}/${TatumConfig.CHAIN}/address/${walletData.xpub}/${index}`,
          {
            headers: {
              accept: "application/json",
              "x-testnet-type": TatumConfig.CHAIN_TYPE,
              "x-api-key": TatumConfig.API_KEY,
            },
          }
        );

        if (response.status !== 200) {
          index++;
          continue;
        }
        const data = response.data;
        console.log(`wallet address at index ${index}`, data);
        addresses.push(data);

        index++;
      } catch (indexError: any) {
        console.log(
          `Failed to generate address at index ${index}:`,
          indexError?.response?.status,
          indexError?.response?.data
        );
      }
    }
    return addresses;
  } catch (error: unknown) {
    console.log("Error while generating unique address:", error);
  }
};

//
const createSubscription = async () => {
  try {
    const response = await axios.post(
      `${TatumConfig.SUB_URL}`,
      {
        type: "INCOMING_FUNGIBLE_TX",

        attr: {
          chain: "ethereum-sepolia",
          url: `${TatumConfig.WEBHOOK_URL}`,
          address: `${TatumConfig.TEST_ADDRESS}`,
        },
      },
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-api-key": `${TatumConfig.API_KEY}`,
        },
      }
    );

    if (!response.data) {
      console.log("No data returned");
    }
    console.log("Subscription created Successfully:", response.data);
  } catch (error: unknown) {
    console.log("Error creating a subscription:", error);
  }
};

const main = async () => {
  const command = process.argv[2] || "help";

  switch (command) {
    case "wallet":
      console.log("Running GenerateMasterWallet...");
      await GenerateMasterWallet();
      break;
    case "addresses":
      console.log("Running GenerateAddress...");
      const addresses = await GenerateAddress();
      console.log("All generated addresses:", addresses);
      break;
    case "subscribe":
      console.log("Running createSubscription...");
      await createSubscription();
      break;
    default:
      console.log("Usage: npm run masterwallet <command>");
      console.log("Commands:");
      console.log("  wallet     - Generate master wallet");
      console.log("  addresses  - Generate addresses");
      console.log("  subscribe  - Create subscription");
  }
};

main().catch(console.error);
