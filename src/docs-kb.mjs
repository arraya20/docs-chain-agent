// src/docs-kb.mjs — Pharos Developer Docs Knowledge Engine & Function Explainer
import { createHash } from "node:crypto";

export const PHAROS_NETWORK_SPECS = {
  networkName: "Pharos Pacific Mainnet",
  chainId: 1672,
  nativeSymbol: "PROS",
  nativeDecimals: 18,
  rpcEndpoints: [
    "https://rpc.pharos.xyz",
    "https://rpc-mainnet.pharos.xyz"
  ],
  mcpEndpoints: {
    chainMcp: "https://mcp.pharos.xyz/mcp",
    docsMcp: "https://docs-mcp.pharos.xyz/mcp"
  },
  blockTimeSec: 2,
  multicall3Address: "0xcA11bde05977b3631167028862bE2a173976CA11"
};

export const CONTRACT_DOCS = {
  // ERC-20 Core & Extensions
  "allowance(address,address)": {
    standard: "ERC-20 (EIP-20)",
    category: "Token Approval & Spending",
    signature: "allowance(address,address)",
    selector: "0xdd62ed3e",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address", description: "The account granting permission to spend tokens." },
      { name: "spender", type: "address", description: "The account authorized to spend on behalf of the owner." }
    ],
    outputs: [
      { name: "remaining", type: "uint256", description: "Amount of remaining tokens spender is permitted to spend." }
    ],
    summary: "Returns the remaining number of tokens that spender is allowed to spend on behalf of owner through transferFrom.",
    securityNotes: "Subject to ERC-20 approval race condition if updated from non-zero to non-zero without zeroing first.",
    commonRevertReasons: ["Target address is an EOA (returns no data or reverts)", "Non-standard token implementation"]
  },
  "balanceOf(address)": {
    standard: "ERC-20 / ERC-721 (EIP-20 / EIP-721)",
    category: "Account State",
    signature: "balanceOf(address)",
    selector: "0x70a08231",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address", description: "The address of the token holder to inspect." }
    ],
    outputs: [
      { name: "balance", type: "uint256", description: "Raw token balance of the specified account in smallest units." }
    ],
    summary: "Returns the balance of tokens owned by the specified account.",
    securityNotes: "Raw balance must be scaled using decimals() for display. Reentrancy checks apply when tokens trigger hooks.",
    commonRevertReasons: ["Zero address queried on strict ERC-721 contracts", "Target is not a contract"]
  },
  "totalSupply()": {
    standard: "ERC-20 / ERC-721 (EIP-20 / EIP-721)",
    category: "Token Supply",
    signature: "totalSupply()",
    selector: "0x18160ddd",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "total", type: "uint256", description: "Total token supply currently in circulation." }
    ],
    summary: "Returns the total token supply currently minted and not burned.",
    securityNotes: "Can dynamically change via mint/burn functions. Some rebasing tokens calculate this dynamically.",
    commonRevertReasons: ["Target is not a contract or does not implement ERC-20/721 standard"]
  },
  "decimals()": {
    standard: "ERC-20 (EIP-20 Optional Extension)",
    category: "Metadata",
    signature: "decimals()",
    selector: "0x313ce567",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "decimals", type: "uint8", description: "Number of decimals used to format human-readable amounts (commonly 18 or 6)." }
    ],
    summary: "Returns the number of decimals the token uses for display formatting.",
    securityNotes: "Most EVM tokens use uint8, but ABI encodes it right-padded to 32 bytes. Default is 18 if unspecified in UI.",
    commonRevertReasons: ["Token does not implement optional ERC-20 metadata extension"]
  },
  "symbol()": {
    standard: "ERC-20 / ERC-721 (EIP-20 / EIP-721 Metadata)",
    category: "Metadata",
    signature: "symbol()",
    selector: "0x95d89b41",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "symbol", type: "string", description: "Short symbol/ticker of the token (e.g. PROS, USDC, WETH)." }
    ],
    summary: "Returns the ticker symbol of the contract.",
    securityNotes: "Older contracts (like MKR) return bytes32 instead of string. Robust decoders must fallback to bytes32.",
    commonRevertReasons: ["Contract does not implement symbol() or uses non-standard bytes32 return"]
  },
  "name()": {
    standard: "ERC-20 / ERC-721 (EIP-20 / EIP-721 Metadata)",
    category: "Metadata",
    signature: "name()",
    selector: "0x06fdde03",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "name", type: "string", description: "Full descriptive name of the token." }
    ],
    summary: "Returns the human-readable name of the token contract.",
    securityNotes: "Subject to dynamic string ABI encoding or legacy bytes32 layout.",
    commonRevertReasons: ["Contract does not implement name()"]
  },
  "owner()": {
    standard: "OpenZeppelin Ownable",
    category: "Access Control",
    signature: "owner()",
    selector: "0x8da5cb5b",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "owner", type: "address", description: "Address of the current contract administrator/owner." }
    ],
    summary: "Returns the address of the current contract owner with administrative privileges.",
    securityNotes: "Critical for security evaluation: if owner is an EOA, central governance risk exists. If address(0), ownership was renounced.",
    commonRevertReasons: ["Contract does not implement standard Ownable pattern or uses 2-step Ownable2Step"]
  },
  "paused()": {
    standard: "OpenZeppelin Pausable",
    category: "Emergency & Operational State",
    signature: "paused()",
    selector: "0x5c975abb",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "isPaused", type: "bool", description: "True if the contract transfers/actions are currently halted." }
    ],
    summary: "Returns true if the contract is currently in a paused state, preventing critical actions.",
    securityNotes: "When paused is true, user transfers, deposits, or withdrawals will revert with EnforcedPause.",
    commonRevertReasons: ["Contract does not implement Pausable"]
  },
  "nonces(address)": {
    standard: "EIP-2612 / Permit Extension",
    category: "Gasless Approvals (Permit)",
    signature: "nonces(address)",
    selector: "0x7ecebe00",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address", description: "Address of the token holder whose permit nonce is queried." }
    ],
    outputs: [
      { name: "nonce", type: "uint256", description: "Current replay-protection nonce for permit signatures." }
    ],
    summary: "Returns the current nonce used for gasless ERC-20 permit signatures according to EIP-2612.",
    securityNotes: "Must increment on every successful permit call to prevent replay attacks across transactions.",
    commonRevertReasons: ["Contract does not implement EIP-2612 Permit extension"]
  },
  "ownerOf(uint256)": {
    standard: "ERC-721 (EIP-721 Non-Fungible Token)",
    category: "NFT Ownership",
    signature: "ownerOf(uint256)",
    selector: "0x6352211e",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256", description: "The identifier for an NFT." }
    ],
    outputs: [
      { name: "owner", type: "address", description: "Address of the owner of the given token ID." }
    ],
    summary: "Finds the owner of an NFT specified by its unique tokenId.",
    securityNotes: "Reverts if tokenId does not exist or has been burned.",
    commonRevertReasons: ["ERC721NonexistentToken: queried token ID does not exist"]
  },
  "tokenURI(uint256)": {
    standard: "ERC-721 Metadata (EIP-721)",
    category: "NFT Metadata",
    signature: "tokenURI(uint256)",
    selector: "0xc87b56dd",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256", description: "The NFT identifier to query metadata URI for." }
    ],
    outputs: [
      { name: "uri", type: "string", description: "Uniform Resource Identifier (URI) for token metadata (HTTP/IPFS)." }
    ],
    summary: "Returns the metadata URI pointing to JSON attributes for the NFT.",
    securityNotes: "URI can be mutable if stored off-chain on centralized web servers vs immutable IPFS/Arweave.",
    commonRevertReasons: ["Token ID does not exist"]
  },
  "supportsInterface(bytes4)": {
    standard: "ERC-165 Standard Interface Detection",
    category: "Introspection",
    signature: "supportsInterface(bytes4)",
    selector: "0x01ffc9a7",
    stateMutability: "view",
    inputs: [
      { name: "interfaceId", type: "bytes4", description: "4-byte interface identifier XOR of function selectors." }
    ],
    outputs: [
      { name: "supported", type: "bool", description: "True if contract claims compliance with the interface." }
    ],
    summary: "Queries if a contract implements a specific interface identifier as specified in ERC-165.",
    securityNotes: "Passing 0xffffffff must return false per EIP-165 specification.",
    commonRevertReasons: ["Contract does not implement ERC-165"]
  },
  "getEthBalance(address)": {
    standard: "Multicall3 Aggregate Interface",
    category: "Utility / Multicall3",
    signature: "getEthBalance(address)",
    selector: "0x4d2301cc",
    stateMutability: "view",
    inputs: [
      { name: "addr", type: "address", description: "Target address to inspect native PROS balance." }
    ],
    outputs: [
      { name: "balance", type: "uint256", description: "Native coin balance in Wei." }
    ],
    summary: "Reads the native coin (PROS) balance of an account via Multicall3 at 0xcA11bde05977b3631167028862bE2a173976CA11.",
    securityNotes: "Useful for bundling batch balance checks without separate RPC roundtrips.",
    commonRevertReasons: ["Invalid target address"]
  }
};

/**
 * Search the documentation for matching contract functions, standards, or topics.
 */
export function searchDocs(query) {
  if (!query || typeof query !== "string") {
    return Object.values(CONTRACT_DOCS);
  }
  const clean = query.trim().toLowerCase();
  const results = [];
  for (const [key, doc] of Object.entries(CONTRACT_DOCS)) {
    const fnName = key.split("(")[0].toLowerCase();
    const match = key.toLowerCase().includes(clean) ||
      fnName.includes(clean) ||
      doc.standard.toLowerCase().includes(clean) ||
      doc.category.toLowerCase().includes(clean) ||
      doc.summary.toLowerCase().includes(clean);
    if (match) {
      results.push(doc);
    }
  }
  return results;
}

/**
 * Retrieve specific function documentation or generate dynamic specification for custom signature.
 */
export function explainFunction(fnQuery) {
  if (!fnQuery || typeof fnQuery !== "string") {
    throw new Error("Function query string is required");
  }
  const clean = fnQuery.trim().replace(/\s+/g, "");

  // Direct match
  if (CONTRACT_DOCS[clean]) {
    return { ...CONTRACT_DOCS[clean], isStandard: true };
  }

  // Name-only match
  const nameOnly = clean.split("(")[0];
  const candidates = Object.entries(CONTRACT_DOCS).filter(([k]) => k.startsWith(`${nameOnly}(`));
  if (candidates.length === 1) {
    return { ...candidates[0][1], isStandard: true };
  } else if (candidates.length > 1) {
    // If ambiguous and exact signature not specified, pick the first standard one
    return { ...candidates[0][1], isStandard: true };
  }

  // Parse custom function signature: e.g. "myCustomFunc(address,uint256)"
  const sigMatch = clean.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\((.*)\)$/);
  if (sigMatch) {
    const name = sigMatch[1];
    const paramStr = sigMatch[2];
    const rawTypes = paramStr ? paramStr.split(",").map(t => t.trim()) : [];
    
    // Calculate 4-byte selector using keccak256
    const normalizedSig = `${name}(${rawTypes.join(",")})`;
    const selector = computeSelector(normalizedSig);

    const inputs = rawTypes.map((type, idx) => ({
      name: `arg${idx}`,
      type,
      description: `Input parameter of type ${type}`
    }));

    return {
      standard: "Custom / Unindexed Interface",
      category: "Application Specific",
      signature: normalizedSig,
      selector,
      stateMutability: "view",
      inputs,
      outputs: [
        { name: "result", type: "raw_bytes", description: "EVM return data decoded according to signature" }
      ],
      summary: `Custom contract function ${normalizedSig} parsed from developer signature specification.`,
      securityNotes: "Ensure input parameters match contract storage expectations and target implements this selector.",
      commonRevertReasons: ["Contract does not implement function selector", "Execution reverted during eth_call"],
      isStandard: false
    };
  }

  throw new Error(`Unable to resolve function signature from query "${fnQuery}". Provide signature like "balanceOf(address)" or "myFunc(address,uint256)".`);
}

/**
 * Pure zero-dependency Keccak-256 implementation for accurate EVM 4-byte selector calculation.
 */
function rotl64(x, n) {
  const shift = BigInt(n % 64);
  return ((x << shift) | (x >> (64n - shift))) & 0xffffffffffffffffn;
}

export function keccak256(msg) {
  const bytes = typeof msg === "string" ? Buffer.from(msg, "utf8") : Buffer.from(msg);
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
  ];

  const RHO = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14]
  ];

  const rate = 136;
  const state = Array.from({ length: 5 }, () => new Array(5).fill(0n));

  const padLen = rate - (bytes.length % rate);
  const padded = Buffer.alloc(bytes.length + padLen);
  bytes.copy(padded, 0);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      const x = i % 5;
      const y = Math.floor(i / 5);
      state[x][y] ^= padded.readBigUInt64LE(offset + i * 8);
    }

    for (let round = 0; round < 24; round++) {
      // Theta
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4];
      }
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotl64(C[(x + 1) % 5], 1);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x][y] ^= D[x];
        }
      }

      // Rho and Pi
      const B = Array.from({ length: 5 }, () => new Array(5).fill(0n));
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          B[y][(2 * x + 3 * y) % 5] = rotl64(state[x][y], RHO[x][y]);
        }
      }

      // Chi
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x][y] = (B[x][y] ^ ((~B[(x + 1) % 5][y]) & B[(x + 2) % 5][y])) & 0xffffffffffffffffn;
        }
      }

      // Iota
      state[0][0] ^= RC[round];
    }
  }

  const out = Buffer.alloc(32);
  let outIdx = 0;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (outIdx >= 32) break;
      out.writeBigUInt64LE(state[x][y], outIdx);
      outIdx += 8;
    }
    if (outIdx >= 32) break;
  }
  return out.toString("hex");
}

/**
 * Compute 4-byte EVM selector using keccak256 (or fast standard lookup).
 */
export function computeSelector(signature) {
  // Common standard fast lookup
  for (const doc of Object.values(CONTRACT_DOCS)) {
    if (doc.signature === signature) return doc.selector;
  }
  const hash = keccak256(signature);
  return `0x${hash.slice(0, 8)}`;
}
