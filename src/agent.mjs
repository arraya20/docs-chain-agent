// src/agent.mjs — Composed Docs MCP + Chain MCP Agent Pipeline
import { explainFunction, searchDocs, PHAROS_NETWORK_SPECS } from "./docs-kb.mjs";
import { isValidAddress, normalizeAddress, buildCalldata, decodeReturnData } from "./abi.mjs";
import { mcpInitialize, mcpCallTool, mcpClose, DEFAULT_CHAIN_MCP_URL } from "./mcp.mjs";
import { formatUnits } from "./format.mjs";

/**
 * Execute the full Docs MCP Grounding + Chain MCP Execution Agent Pipeline.
 */
export async function runDocsChainAgent({
  contractAddress,
  functionQuery,
  args = [],
  mcpUrl = DEFAULT_CHAIN_MCP_URL,
  clientName = "pharos-docs-chain-agent",
  timeoutMs = 30_000,
  allowEoa = false,
  rawProbe = false
}) {
  const traces = [];
  const addTrace = (step, message) => traces.push({ step, message, timestamp: new Date().toISOString() });

  addTrace("INIT", `Starting Docs MCP + Chain MCP agent pipeline for query: "${functionQuery}"`);

  // 1. Validate Target Contract Address
  if (!isValidAddress(contractAddress)) {
    throw new Error(`Target contract address is invalid: "${contractAddress}". Must be a 0x-prefixed 40-hex character EVM address.`);
  }
  const targetContract = normalizeAddress(contractAddress);
  addTrace("VALIDATION", `Normalized target contract address: ${targetContract}`);

  // 2. Step 1: Docs Grounding & Function Explanation
  addTrace("DOCS_GROUNDING", `Querying Developer Docs knowledge base for function "${functionQuery}"`);
  const doc = explainFunction(functionQuery);
  addTrace("DOCS_GROUNDING", `Resolved standard: ${doc.standard} | Selector: ${doc.selector} | Inputs: ${doc.inputs.length}`);

  // 3. Step 2: Calldata Synthesis
  addTrace("CALLDATA_SYNTHESIS", `Encoding parameters: ${JSON.stringify(args)}`);
  const calldata = buildCalldata(doc, args);
  addTrace("CALLDATA_SYNTHESIS", `Synthesized calldata: ${calldata}`);

  // 4. Step 3: Chain MCP Connect & Pinned Block Read
  addTrace("CHAIN_MCP_CONNECT", `Connecting to Pharos Chain MCP endpoint: ${mcpUrl}`);
  const session = await mcpInitialize(mcpUrl, clientName, timeoutMs);
  const sessionId = session.sessionId;

  try {
    // Verify chain ID - fail closed
    const chainInfoTool = await mcpCallTool({
      url: mcpUrl,
      sessionId,
      id: 2,
      name: "get_chain_info",
      args: {},
      timeoutMs
    });
    const chainInfoText = chainInfoTool?.content?.[0]?.text;
    if (!chainInfoText || typeof chainInfoText !== "string" || !chainInfoText.trim()) {
      throw new Error("Chain verification failed: empty or missing response from Chain MCP get_chain_info");
    }

    let chainInfo = null;
    try {
      chainInfo = JSON.parse(chainInfoText);
    } catch {
      throw new Error(`Chain verification failed: invalid JSON response from Chain MCP get_chain_info: "${chainInfoText}"`);
    }

    const rawChainId = chainInfo?.chainId ?? (typeof chainInfo === "number" || typeof chainInfo === "string" ? chainInfo : undefined);
    if (rawChainId === undefined || rawChainId === null || rawChainId === "") {
      throw new Error(`Chain verification failed: missing chainId property in Chain MCP get_chain_info response: ${chainInfoText}`);
    }

    const chainIdNum = Number(rawChainId);
    if (!Number.isFinite(chainIdNum) || isNaN(chainIdNum)) {
      throw new Error(`Chain verification failed: invalid non-numeric chainId returned by Chain MCP: ${rawChainId}`);
    }

    if (chainIdNum !== PHAROS_NETWORK_SPECS.chainId) {
      throw new Error(`Chain verification failed: chain ID mismatch. Expected ${PHAROS_NETWORK_SPECS.chainId}, received ${chainIdNum}`);
    }
    addTrace("CHAIN_MCP_VERIFY", `Verified Pharos chain ID: ${chainIdNum}`);

    // Pin current block number
    const blockNumberTool = await mcpCallTool({
      url: mcpUrl,
      sessionId,
      id: 3,
      name: "get_block_number",
      args: {},
      timeoutMs
    });
    const blockNumText = blockNumberTool?.content?.[0]?.text || "0";
    let pinnedBlock = null;
    try {
      const parsed = JSON.parse(blockNumText);
      pinnedBlock = parsed.blockNumber ?? parsed;
    } catch {
      pinnedBlock = blockNumText.trim();
    }
    addTrace("CHAIN_MCP_PIN", `Pinned execution block height: #${pinnedBlock}`);

    // Verify contract bytecode
    const getCodeTool = await mcpCallTool({
      url: mcpUrl,
      sessionId,
      id: 4,
      name: "get_code",
      args: { address: targetContract, block: pinnedBlock },
      timeoutMs
    });
    const codeText = getCodeTool?.content?.[0]?.text || "";
    let code = "";
    try {
      const parsed = JSON.parse(codeText);
      code = typeof parsed === "string" ? parsed : parsed?.code ?? codeText;
    } catch {
      code = codeText.trim();
    }
    const bytecodeVerified = Boolean(code && code !== "0x" && code !== "0x0" && code.length > 2);
    if (!bytecodeVerified) {
      const isAllowed = Boolean(allowEoa || rawProbe);
      if (!isAllowed) {
        addTrace("BYTECODE_CHECK", `Error: Target address ${targetContract} has no active contract bytecode at block #${pinnedBlock}. Aborting.`);
        throw new Error(`Bytecode verification failed: address ${targetContract} has no deployed contract bytecode at block #${pinnedBlock}. Execution halted (pass allowEoa/rawProbe to override).`);
      }
      addTrace("BYTECODE_CHECK", `Warning: Target address has no active bytecode at block #${pinnedBlock} (EOA / raw probing mode enabled)`);
    } else {
      addTrace("BYTECODE_CHECK", `Active contract bytecode verified (${code.length / 2 - 1} bytes)`);
    }

    // 5. Execute eth_call
    addTrace("CHAIN_MCP_EXECUTE", `Executing eth_call to ${targetContract} with calldata ${calldata} at block #${pinnedBlock}`);
    const ethCallTool = await mcpCallTool({
      url: mcpUrl,
      sessionId,
      id: 5,
      name: "eth_call",
      args: {
        transaction: {
          to: targetContract,
          data: calldata
        },
        block: pinnedBlock
      },
      timeoutMs
    });
    const callText = ethCallTool?.content?.[0]?.text || "";
    let rawReturn = "";
    try {
      const parsed = JSON.parse(callText);
      rawReturn = parsed.result ?? parsed.data ?? parsed.output ?? callText;
    } catch {
      rawReturn = callText.trim();
    }
    addTrace("CHAIN_MCP_EXECUTE", `Received raw return data: ${rawReturn}`);

    // 6. Decode output
    const decodedResult = decodeReturnData(rawReturn, doc.outputs);
    addTrace("DECODING", `Decoded result: ${decodedResult.formatted}`);

    // Optional: read decimals & symbol if token amount
    let scaledValue = null;
    let symbol = null;
    let decimals = null;
    if (
      bytecodeVerified &&
      (doc.signature.startsWith("balanceOf") || doc.signature.startsWith("totalSupply") || doc.signature.startsWith("allowance")) &&
      typeof decodedResult.decoded === "string" &&
      /^\d+$/.test(decodedResult.decoded)
    ) {
      try {
        const decCall = await mcpCallTool({
          url: mcpUrl,
          sessionId,
          id: 6,
          name: "eth_call",
          args: {
            transaction: { to: targetContract, data: "0x313ce567" },
            block: pinnedBlock
          },
          timeoutMs
        });
        const decRaw = JSON.parse(decCall?.content?.[0]?.text || "{}").result || decCall?.content?.[0]?.text;
        const decDecoded = decodeReturnData(decRaw, [{ type: "uint8" }]);
        decimals = Number(decDecoded.decoded) || 18;

        const symCall = await mcpCallTool({
          url: mcpUrl,
          sessionId,
          id: 7,
          name: "eth_call",
          args: {
            transaction: { to: targetContract, data: "0x95d89b41" },
            block: pinnedBlock
          },
          timeoutMs
        });
        const symRaw = JSON.parse(symCall?.content?.[0]?.text || "{}").result || symCall?.content?.[0]?.text;
        const symDecoded = decodeReturnData(symRaw, [{ type: "string" }]);
        symbol = symDecoded.decoded || "TOKENS";

        const formattedNumber = formatUnits(decodedResult.decoded, decimals);
        scaledValue = `${formattedNumber} ${symbol} (decimals: ${decimals})`;
        addTrace("ENRICHMENT", `Scaled token value: ${scaledValue}`);
      } catch {
        // Enrichment is optional
      }
    }

    addTrace("COMPLETE", "Docs MCP + Chain MCP agent pipeline completed successfully");

    return {
      success: true,
      timestamp: new Date().toISOString(),
      targetContract,
      network: PHAROS_NETWORK_SPECS,
      pinnedBlock,
      mcpEndpoint: mcpUrl,
      bytecodeVerified,
      doc,
      args,
      calldata,
      rawReturn,
      decodedValue: decodedResult.decoded,
      formattedValue: decodedResult.formatted,
      scaledValue,
      tokenMetadata: decimals !== null ? { decimals, symbol } : null,
      traces
    };
  } finally {
    await mcpClose(mcpUrl, sessionId).catch(() => {});
  }
}
