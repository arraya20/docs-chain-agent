import test from "node:test";
import assert from "node:assert/strict";
import { runDocsChainAgent } from "../src/agent.mjs";

test("runDocsChainAgent executes end-to-end read on live Pharos Mainnet", async () => {
  const result = await runDocsChainAgent({
    contractAddress: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
    functionQuery: "totalSupply",
    args: []
  });

  assert.equal(result.success, true);
  assert.equal(result.targetContract, "0x6b0a44c64190279f7034b77c13a566e914fe5ec4");
  assert.equal(result.doc.signature, "totalSupply()");
  assert.equal(result.calldata, "0x18160ddd");
  assert.equal(result.bytecodeVerified, true);
  assert.ok(result.pinnedBlock > 0);
  assert.match(String(result.decodedValue), /^\d+$/);
  assert.ok(result.traces.length >= 8);
});
