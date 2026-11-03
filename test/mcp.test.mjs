import test from "node:test";
import assert from "node:assert/strict";
import { parseMcpResponse } from "../src/mcp.mjs";

test("parseMcpResponse parses direct JSON object", () => {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, result: { success: true } });
  const parsed = parseMcpResponse(payload, 1);
  assert.equal(parsed.id, 1);
  assert.equal(parsed.result.success, true);
});

test("parseMcpResponse parses SSE data stream", () => {
  const sseText = [
    "event: message",
    'data: {"jsonrpc":"2.0","id":42,"result":{"blockNumber":"21945000"}}',
    "",
    ""
  ].join("\n");
  const parsed = parseMcpResponse(sseText, 42);
  assert.equal(parsed.id, 42);
  assert.equal(parsed.result.blockNumber, "21945000");
});

test("parseMcpResponse rejects mismatched response id", () => {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: 99, result: {} });
  assert.throws(() => parseMcpResponse(payload, 1), /id mismatch/);
});
