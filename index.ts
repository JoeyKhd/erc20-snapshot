import dotenv from "dotenv";
import {
  Address,
  createPublicClient,
  http,
  parseAbiItem,
  decodeEventLog,
  DecodeEventLogReturnType,
} from "viem";
import { mainnet } from "viem/chains";
import _ from "lodash";
import * as Utils from "./utils";
import { erc20Abi } from "./abi/erc20";
dotenv.config();

Utils.errorAndExit(process.env.RPC_URL, "RPC_URL missing from .env");

const transport = http(process.env.RPC_URL);

const client = createPublicClient({
  batch: {
    multicall: {
      wait: 250,
    },
  },
  chain: mainnet,
  transport,
});

const CONTRACTADDRESS: Address = "0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4";
const DEPLOYMENT_BLOCK: number = 12475891;
const SNAPSHOT_BLOCK: number = 17463809;
const BLOCKS_PER_BATCH: number = 5000;

const addresses = new Set<Address>();

const getAddresses = async () => {
  const blocks: number[] = [];
  for (let x = DEPLOYMENT_BLOCK; x <= SNAPSHOT_BLOCK; x++) {
    blocks.push(x);
  }

  const batches: number[][] = _.chunk(blocks, BLOCKS_PER_BATCH);

  for (const batch of batches) {
    const fromBlock: bigint = BigInt(batch[0]);
    const toBlock: bigint = BigInt(batch[batch.length - 1]);

    console.log(`Getting transfer events from ${fromBlock} to ${toBlock}`);

    const filter = await client.createEventFilter({
      address: CONTRACTADDRESS,
      event: parseAbiItem("event Transfer(address indexed, address indexed, uint256)"),
      fromBlock,
      toBlock,
    });

    const logs = await client.getFilterLogs({ filter });
    console.log(logs);
    for (const log of logs) {
      const topics: DecodeEventLogReturnType = decodeEventLog({
        abi: erc20Abi,
        data: log.data,
        topics: log.topics,
      });
      console.log(topics);
      const args: any = topics.args;
      addresses.add(args.from);
      addresses.add(args.to);
    }
    await Utils.sleep(500);
  }
};

const getBalances = () => {};

const writeOutput = () => {};

getAddresses();
