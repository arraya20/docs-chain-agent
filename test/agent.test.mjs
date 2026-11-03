import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { runDocsChainAgent } from "../src/agent.mjs";

function startMockMcpServer(options = {}) {
  const {
    chainId = 1672,
    blockNumber = "21945000",
    code = "0x608060405234801561001057600080fd5b50",
    ethCallResult = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    rawChainInfoText
  } = options;

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      if (req.method === "DELETE") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      let payload = {};
      try { payload = JSON.parse(body); } catch {}
      const id = payload.id ?? 1;
      const method = payload.method;

      if (method === "initialize") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "mcp-session-id": "mock-session-test"
        });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            serverInfo: { name: "mock-pharos-mcp", version: "1.0.0" }
          }
        }));
        return;
      }

      if (method === "notifications/initialized") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", result: {} }));
        return;
      }

      if (method === "tools/call") {
        const toolName = payload.params?.name;
        if (toolName === "get_chain_info") {
          const text = rawChainInfoText !== undefined
            ? rawChainInfoText
            : JSON.stringify({ chainId, name: "Pharos Mainnet" });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text }] }
          }));
          return;
        }

        if (toolName === "get_block_number") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: String(blockNumber) }] }
          }));
          return;
        }

        if (toolName === "get_code") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: code }] }
          }));
          return;
        }

        if (toolName === "eth_call") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: ethCallResult }] }
          }));
          return;
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id, result: {} }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}/mcp`;
      resolve({
        url,
        server,
        close: () => new Promise(res => server.close(res))
      });
    });
  });
}

test("runDocsChainAgent validates contract address before network calls", async () => {
  await assert.rejects(
    async () => {
      await runDocsChainAgent({
        contractAddress: "invalid_address",
        functionQuery: "totalSupply"
      });
    },
    /Target contract address is invalid/
  );
});

test("runDocsChainAgent validates parameter counts", async () => {
  await assert.rejects(
    async () => {
      await runDocsChainAgent({
        contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
        functionQuery: "allowance(address,address)",
        args: ["0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51"] // Missing 2nd arg
      });
    },
    /Argument count mismatch/
  );
});

test("runDocsChainAgent executes end-to-end read with deterministic Mock MCP", async () => {
  const mockMcp = await startMockMcpServer();
  try {
    const result = await runDocsChainAgent({
      contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      functionQuery: "totalSupply",
      args: [],
      mcpUrl: mockMcp.url
    });

    assert.equal(result.success, true);
    assert.equal(result.targetContract, "0x6b0a44c64190279f7034b77c13a566e914fe5ec4");
    assert.equal(result.doc.signature, "totalSupply()");
    assert.equal(result.calldata, "0x18160ddd");
    assert.equal(result.bytecodeVerified, true);
    assert.equal(String(result.pinnedBlock), "21945000");
    assert.equal(result.decodedValue, "1000000000000000000");
    assert.ok(result.traces.length >= 8);
  } finally {
    await mockMcp.close();
  }
});

test("runDocsChainAgent fails closed when chain ID verification response is empty or invalid JSON", async () => {
  const mockEmpty = await startMockMcpServer({ rawChainInfoText: "" });
  try {
    await assert.rejects(
      async () => {
        await runDocsChainAgent({
          contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
          functionQuery: "totalSupply",
          mcpUrl: mockEmpty.url
        });
      },
      /Chain verification failed/
    );
  } finally {
    await mockEmpty.close();
  }

  const mockInvalidJson = await startMockMcpServer({ rawChainInfoText: "not_a_json" });
  try {
    await assert.rejects(
      async () => {
        await runDocsChainAgent({
          contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
          functionQuery: "totalSupply",
          mcpUrl: mockInvalidJson.url
        });
      },
      /Chain verification failed/
    );
  } finally {
    await mockInvalidJson.close();
  }
});

test("runDocsChainAgent fails closed when chain ID does not match Pharos 1672", async () => {
  const mockWrongChain = await startMockMcpServer({ chainId: 1 }); // Ethereum Mainnet
  try {
    await assert.rejects(
      async () => {
        await runDocsChainAgent({
          contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
          functionQuery: "totalSupply",
          mcpUrl: mockWrongChain.url
        });
      },
      /Chain ID mismatch/i
    );
  } finally {
    await mockWrongChain.close();
  }
});

test("runDocsChainAgent halts execution on address without bytecode unless allowEoa is set", async () => {
  const mockNoBytecode = await startMockMcpServer({ code: "0x" });
  try {
    // Fails without allowEoa / rawProbe
    await assert.rejects(
      async () => {
        await runDocsChainAgent({
          contractAddress: "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51",
          functionQuery: "totalSupply",
          mcpUrl: mockNoBytecode.url,
          allowEoa: false
        });
      },
      /Bytecode verification failed/
    );

    // Succeeds when allowEoa: true
    const result = await runDocsChainAgent({
      contractAddress: "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51",
      functionQuery: "totalSupply",
      mcpUrl: mockNoBytecode.url,
      allowEoa: true
    });
    assert.equal(result.success, true);
    assert.equal(result.bytecodeVerified, false);
  } finally {
    await mockNoBytecode.close();
  }
});

test("runDocsChainAgent treats quoted empty bytecode as no bytecode", async () => {
  const mockQuotedEmpty = await startMockMcpServer({ code: JSON.stringify("0x") });
  try {
    await assert.rejects(
      async () => {
        await runDocsChainAgent({
          contractAddress: "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51",
          functionQuery: "totalSupply",
          mcpUrl: mockQuotedEmpty.url
        });
      },
      /Bytecode verification failed/
    );
  } finally {
    await mockQuotedEmpty.close();
  }
});
