import dotenv from "dotenv";
import {
  Address,
  createPublicClient,
  http,
  parseAbiItem,
  decodeEventLog,
  DecodeEventLogReturnType,
  BlockTag,
  Block,
} from "viem";
import { mainnet } from "viem/chains";
import _ from "lodash";
import * as Utils from "./utils";
import { erc20Abi } from "./abi/erc20";
import moment from "moment";

dotenv.config();

Utils.errorAndExit(process.env.RPC_URL, "RPC_URL missing from .env");
Utils.errorAndExit(process.env.DEPLOYMENT_BLOCK, "DEPLOYMENT_BLOCK missing from .env");
Utils.errorAndExit(process.env.SNAPSHOT_BLOCK, "SNAPSHOT_BLOCK missing from .env");
Utils.errorAndExit(process.env.BLOCKS_PER_BATCH, "BLOCKS_PER_BATCH missing from .env");
Utils.errorAndExit(process.env.SLEEP_TIMEOUT, "SLEEP_TIMEOUT missing from .env");

const transport = http(process.env.RPC_URL);

const client = createPublicClient({
  batch: {
    multicall: {
      wait: 1500,
      batchSize: 500,
    },
  },
  chain: mainnet,
  transport,
});

const CONTRACTADDRESS: Address = process.env.CONTRACTADDRESS;
const DEPLOYMENT_BLOCK: number = process.env.DEPLOYMENT_BLOCK;
let SNAPSHOT_BLOCK: number | string | BlockTag = process.env.SNAPSHOT_BLOCK;
const BLOCKS_PER_BATCH: number = process.env.BLOCKS_PER_BATCH;
const SLEEP_TIMEOUT: number = process.env.SLEEP_TIMEOUT;

const ALLOWED_BLOCKTAGS: string[] = ["latest", "earliest", "pending", "safe", "finalized"];

const processSnapshotBlock = async () => {
  if (typeof SNAPSHOT_BLOCK == "string") {
    if (!ALLOWED_BLOCKTAGS.includes(SNAPSHOT_BLOCK)) {
      Utils.errorAndExit(
        null,
        "Detected SNAPSHOT_BLOCK is a string, but is not an allowed BlockTag. Try one of those: latest, earliest, pending, safe, finalized"
      );
    }
    const blockTag: BlockTag = SNAPSHOT_BLOCK as BlockTag;
    const block = await client.getBlock({ blockTag });

    console.log(`Detected blockTag: ${blockTag}, therefore setting block number to snapshot on to ${block.number}`);

    if (block.number) {
      SNAPSHOT_BLOCK = Number(block.number);
    }
  }
};

const addresses = new Set<Address>();
const balances: number[] = [];
const contract = {
  address: CONTRACTADDRESS,
  abi: erc20Abi,
} as const;

const getAddresses = async () => {
  const blocks: number[] = [];
  for (let x = DEPLOYMENT_BLOCK; x <= Number(SNAPSHOT_BLOCK); x++) {
    blocks.push(x);
  }

  const batches: number[][] = _.chunk(blocks, BLOCKS_PER_BATCH);

  const totalBatches = batches.length;
  let currentBatch = 0;

  for (const batch of batches) {
    const fromBlock: bigint = BigInt(batch[0]);
    const toBlock: bigint = BigInt(batch[batch.length - 1]);

    console.log(
      `⚙️ Getting transfer events from ${fromBlock} to ${toBlock} (⏱️ remaining: ${moment()
        .add((totalBatches - currentBatch) * SLEEP_TIMEOUT, "millisecond")
        .fromNow(true)})`
    );

    const filter = await client.createEventFilter({
      address: CONTRACTADDRESS,
      event: parseAbiItem("event Transfer(address indexed, address indexed, uint256)"),
      fromBlock,
      toBlock,
    });

    const logs = await client.getFilterLogs({ filter });
    for (const log of logs) {
      const topics: DecodeEventLogReturnType = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      const args: any = topics.args;
      addresses.add(args.from);
      addresses.add(args.to);
    }
    await Utils.sleep(500);
    currentBatch++;
  }
};

const getBalances = async () => {
  console.log(`A total of ${addresses.size} addresses detected to snapshot on.`);
  
  const calls: any[] = [];
  for (const address of addresses.values()) {
    calls.push({
      ...contract,
      functionName: "balanceOf",
      args: [address],
    });
  }

  const results = await client.multicall({
    contracts: calls,
    allowFailure: false,
    blockNumber: BigInt(SNAPSHOT_BLOCK),
  });

  console.log(results);
};

const writeOutput = () => {};

const run = async () => {
  try {
    await processSnapshotBlock();
    await getAddresses();
    await getBalances();
  } catch (err: any) {
    console.error("Stack: ", err);
    console.error("Message: ", err.message);
    console.error(
      `✋🛑 Snapshot has been halted because it is unable to ensure a accurate outcome. View the error above and tweak accordingly.`
    );
  }
};

run();
