# Pharos Docs MCP + Chain MCP Agent

Autonomous developer agent that composes **Pharos Developer Docs MCP** and **Pharos Chain MCP**: explains smart contract functions, validates interface specifications, synthesizes ABI calldata, and executes live, block-pinned on-chain reads.

Built for the **Docs MCP + Chain MCP Agent** challenge in the [Pharos Agent Arena](https://pharos-agent-arena.vercel.app/#tasks).

---

## 🌟 Why This Agent?

In the Agentic Economy, agents should not operate as blind RPC callers. This agent implements a **4-step verifiable cognitive loop**:

1. **Developer Docs Grounding**: Queries official standards (ERC-20, ERC-721, ERC-1155, Ownable, Pausable, Multicall3, EIP-2612 Permit), resolving parameter types, expected outputs, state mutability, and security considerations (e.g. approval race conditions, reentrancy guards).
2. **Calldata Synthesis & Zero-Dependency ABI Engine**: Validates inputs, formats 32-byte words, computes EVM 4-byte selectors via a built-in pure Keccak-256 algorithm, and constructs exact EVM calldata without heavy third-party web3 libraries.
3. **Chain MCP Execution with Provenance**: Connects to the official Pharos Chain MCP server (`https://mcp.pharos.xyz/mcp`), verifies Chain ID `1672`, pins the execution block height, confirms bytecode existence, and dispatches the call.
4. **Decoded Output & Unit Enrichment**: Decodes raw hex data into BigInt strings, formatted UTF-8 strings, or booleans, and automatically enriches token balances with human-readable scaled units.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (zero external runtime dependencies)
- Access to `https://mcp.pharos.xyz/mcp`

### Installation & Verification

```bash
npm ci
npm run check
npm test
```

---

## 💻 CLI Usage

### 1. Interactive Agent Prompt

```bash
npm start
```

### 2. Explain a Contract Function (Docs Grounding Only)

```bash
node src/cli.mjs explain "allowance(address,address)"
node src/cli.mjs search "permit"
node src/cli.mjs list
```

### 3. Run Full Agent Pipeline (Docs Grounding + On-Chain Execution)

```bash
# Query total supply of stPROS token on Pharos Mainnet
node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 totalSupply

# Query token balance of a specific wallet
node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 balanceOf 0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51

# Query allowance between owner and spender
node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 allowance 0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51 0x000000000022D473030F116dDEE9F6B43aC78BA3

# Structured JSON output for downstream agent consumption
node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 totalSupply --json
```

---

## 🌐 Web Demo & Cloudflare Pages Functions

The repository includes a modern Web UI and Cloudflare Pages Functions backend.

### Local Web Preview

```bash
npx wrangler pages dev public
```

### API Endpoints

- `POST /api/agent`: Runs full pipeline.
  ```json
  {
    "contractAddress": "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
    "functionQuery": "balanceOf",
    "args": ["0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51"]
  }
  ```
- `GET /api/explain?q=allowance`: Returns documentation specification for a function.
- `GET /api/search?q=permit`: Searches Developer Docs index.

### Cloudflare Pages Deployment

```bash
npx wrangler pages deploy public --project-name pharos-docs-chain-agent
```

Then attach your custom domain under Cloudflare Pages (e.g. `docs-agent.nampharos.web.id`).

---

## 🔒 Security & Architecture Guarantees

- **Zero Private Keys / Signatures**: Pure read-only inspection agent.
- **Pinned Block Consistency**: Bytecode check, main call, and metadata enrichment all use the same pinned block number.
- **Strict BigInt Handling**: Large `uint256` token amounts and balances avoid IEEE-754 floating-point inaccuracies.
- **Zero Runtime Dependencies**: No bloated frameworks; clean standard ESM with native `fetch` and `node:crypto`.

---

## 📜 License

MIT. Built for the Pharos Agentic Economy.
