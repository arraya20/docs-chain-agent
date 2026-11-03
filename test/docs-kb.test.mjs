import test from "node:test";
import assert from "node:assert/strict";
import { explainFunction, searchDocs, computeSelector, CONTRACT_DOCS } from "../src/docs-kb.mjs";

test("explainFunction resolves standard ERC-20 totalSupply", () => {
  const doc = explainFunction("totalSupply");
  assert.equal(doc.signature, "totalSupply()");
  assert.equal(doc.selector, "0x18160ddd");
  assert.equal(doc.standard, "ERC-20 / ERC-721 (EIP-20 / EIP-721)");
  assert.equal(doc.inputs.length, 0);
  assert.equal(doc.outputs.length, 1);
  assert.equal(doc.outputs[0].type, "uint256");
});

test("explainFunction resolves allowance(address,address)", () => {
  const doc = explainFunction("allowance(address,address)");
  assert.equal(doc.signature, "allowance(address,address)");
  assert.equal(doc.selector, "0xdd62ed3e");
  assert.equal(doc.inputs.length, 2);
  assert.equal(doc.inputs[0].type, "address");
  assert.equal(doc.inputs[1].type, "address");
});

test("explainFunction resolves custom function signature dynamically", () => {
  const doc = explainFunction("mintTokens(address,uint256)");
  assert.equal(doc.signature, "mintTokens(address,uint256)");
  assert.equal(doc.inputs.length, 2);
  assert.equal(doc.inputs[0].type, "address");
  assert.equal(doc.inputs[1].type, "uint256");
  assert.equal(doc.isStandard, false);
  assert.match(doc.selector, /^0x[0-9a-f]{8}$/);
});

test("searchDocs returns matching results", () => {
  const permitMatches = searchDocs("permit");
  assert.ok(permitMatches.length >= 1);
  assert.equal(permitMatches[0].signature, "nonces(address)");

  const balanceMatches = searchDocs("balance");
  assert.ok(balanceMatches.length >= 2);
});

test("computeSelector produces correct EVM 4-byte selector", () => {
  assert.equal(computeSelector("balanceOf(address)"), "0x70a08231");
  assert.equal(computeSelector("transfer(address,uint256)"), "0xa9059cbb");
});
