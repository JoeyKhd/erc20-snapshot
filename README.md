# erc20-snapshot

Take a snapshot of all holders of an ERC20 token and their balances at a given block.

## How it works

1. Scans all `Transfer` events of the token contract, from its deployment block up to the snapshot block (in configurable batches).
2. Collects every address that ever sent or received the token.
3. Resolves each address's balance at the snapshot block via a single `multicall` of `balanceOf`.
4. Writes the results to `./output` as JSON and CSV, plus a details file with the parameters used.

## Requirements

- Node.js 18+
- An RPC endpoint (HTTP or WebSocket) for the chain the token lives on — an archive node is required when snapshotting on a historical block.

## Setup

```bash
npm install
cp .env.skel .env
```

Fill in `.env`:

| Variable           | Description                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `RPC_URL`          | RPC endpoint of the chain node (`https://` or `wss://`).                                     |
| `DEPLOYMENT_BLOCK` | Block at which the token contract was deployed.                                              |
| `SNAPSHOT_BLOCK`   | Block to snapshot on: a block number or a tag (`latest`, `earliest`, `pending`, `safe`, `finalized`). |
| `BLOCKS_PER_BATCH` | Amount of blocks scanned per batch when collecting `Transfer` events.                        |
| `SLEEP_TIMEOUT`    | Delay in milliseconds between batches to avoid rate limiting.                                |
| `CONTRACTADDRESS`  | Address of the ERC20 token contract.                                                         |

## Usage

```bash
npm start
```

## Output

Reports are written to `./output`:

- `report-snapshot-<block>.json` — array of `{ address, balance }` records.
- `report-snapshot-<block>.csv` — same data in CSV format.
- `report-details-<block>.json` — the parameters the snapshot was taken with.

Balances are raw, unsigned integer amounts (not adjusted for the token's `decimals`).
