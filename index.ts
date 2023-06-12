import dotenv from "dotenv";
import {
  Address,
  createPublicClient,
  http,
  parseAbiItem,
  decodeEventLog,
  DecodeEventLogReturnType,
  MulticallContracts,
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
      wait: 500,
    },
  },
  chain: mainnet,
  transport,
});

const CONTRACTADDRESS: Address = "0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4";
const DEPLOYMENT_BLOCK: number = 12475891;
const SNAPSHOT_BLOCK: number = 17463809;
const BLOCKS_PER_BATCH: number = 20000;
const SLEEP_TIMEOUT: number = 500;

const addresses = new Set<Address>();

const contract = {
  address: CONTRACTADDRESS,
  abi: erc20Abi,
} as const;

const getAddresses = async () => {
  const blocks: number[] = [];
  for (let x = DEPLOYMENT_BLOCK; x <= SNAPSHOT_BLOCK; x++) {
    blocks.push(x);
  }

  const batches: number[][] = _.chunk(blocks, BLOCKS_PER_BATCH);

  const totalBatches = batches.length;
  let currentBatch = 0;

  for (const batch of batches) {
    const fromBlock: bigint = BigInt(batch[0]);
    const toBlock: bigint = BigInt(batch[batch.length - 1]);

    console.log(
      `Getting transfer events from ${fromBlock} to ${toBlock} (eta. ${
        (totalBatches - currentBatch) * SLEEP_TIMEOUT
      }ms)`
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
  const addresses = new Set([
    "0x593e580D169b8D53Ed6FC2A361F6b46c86De278D",
    "0x4c7A5Dc4277bCf8f5A1cb6A951FA5862C64171F1",
    "0xd1029Ff2fdEC01ebDcC65aE28C1756A3C1C85d32",
    "0x8aA0B8bf4fD6426F7d2595A65b5a5c9C960497A2",
    "0x9978FbDC278921F7338d29CB2742ddcF36931fbe",
    "0x9b667FA9EF908407Dc90ad0274039fA2fd0007b3",
    "0xee45C399979cB06fa2E883d2E50F911FBc3f17BF",
    "0x790C2E02bE67615F592C5bCA1Ff4a64DB370d100",
    "0x000000005804B22091aa9830E50459A15E7C9241",
    "0x6C4295CFAc4030835f0Fcc621934f19107dd08e7",
    "0xa752EeA12f7ecAA7674363255e5e7F0B083a515C",
    "0x97de9677bD2EFF871C53BAEdEc29e029aFf2D5c4",
    "0x5CAfbD5aE3EBEEfEAE0a1ef6ef21177df4e961a4",
    "0x258F3Ee2D43293dFD07AE5fA811757a73255e77c",
  ]);

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
    await getAddresses();
    await getBalances();
  } catch (err: any) {
    console.error(err);
    console.error(
      `Snapshot has been halted because it is unable to ensure a accurate outcome. View the error above and tweak accordingly.`
    );
  }
};

run();
