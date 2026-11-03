import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidAddress,
  normalizeAddress,
  encodeParam,
  buildCalldata,
  decodeReturnData,
  parseIntegerType,
  parseBytesType,
  validateIntegerRange,
  validateHexBytes
} from "../src/abi.mjs";
import { explainFunction } from "../src/docs-kb.mjs";

test("isValidAddress validates 0x40 hex EVM addresses", () => {
  assert.equal(isValidAddress("0x6b0a44c64190279f7034b77c13a566e914fe5ec4"), true);
  assert.equal(isValidAddress("0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51"), true);
  assert.equal(isValidAddress("0xinvalid"), false);
  assert.equal(isValidAddress("12345"), false);
  assert.equal(isValidAddress(null), false);
});

test("parseIntegerType validates EVM integer widths", () => {
  assert.deepEqual(parseIntegerType("uint256"), { isSigned: false, bits: 256 });
  assert.deepEqual(parseIntegerType("uint8"), { isSigned: false, bits: 8 });
  assert.deepEqual(parseIntegerType("uint"), { isSigned: false, bits: 256 });
  assert.deepEqual(parseIntegerType("int128"), { isSigned: true, bits: 128 });
  assert.deepEqual(parseIntegerType("int"), { isSigned: true, bits: 256 });

  assert.throws(() => parseIntegerType("uint7"), /Invalid integer bit width/);
  assert.throws(() => parseIntegerType("uint264"), /Invalid integer bit width/);
  assert.throws(() => parseIntegerType("int0"), /Invalid integer bit width/);
  assert.equal(parseIntegerType("address"), null);
});

test("parseBytesType validates fixed bytes widths", () => {
  assert.deepEqual(parseBytesType("bytes1"), { bytesLength: 1 });
  assert.deepEqual(parseBytesType("bytes32"), { bytesLength: 32 });
  assert.deepEqual(parseBytesType("bytes4"), { bytesLength: 4 });

  assert.throws(() => parseBytesType("bytes0"), /Invalid bytes length/);
  assert.throws(() => parseBytesType("bytes33"), /Invalid bytes length/);
  assert.equal(parseBytesType("string"), null);
});

test("encodeParam & validateIntegerRange enforce integer bit widths and signed two's complement", () => {
  // uint8 range: 0 .. 255
  assert.equal(encodeParam("uint8", 0), "0".repeat(64));
  assert.equal(encodeParam("uint8", "255"), "0".repeat(62) + "ff");
  assert.throws(() => encodeParam("uint8", 256), /out of range for uint8/);
  assert.throws(() => encodeParam("uint8", -1), /out of range for uint8/);

  // int8 range: -128 .. 127
  assert.equal(encodeParam("int8", 0), "0".repeat(64));
  assert.equal(encodeParam("int8", 127), "0".repeat(62) + "7f");
  assert.equal(encodeParam("int8", -1), "f".repeat(64)); // Sign-extended 256-bit two's complement
  assert.equal(encodeParam("int8", -128), "f".repeat(62) + "80");
  assert.throws(() => encodeParam("int8", 128), /out of range for int8/);
  assert.throws(() => encodeParam("int8", -129), /out of range for int8/);

  // uint256 max
  const maxUint256 = (1n << 256n) - 1n;
  assert.equal(encodeParam("uint256", maxUint256), "f".repeat(64));
  assert.throws(() => encodeParam("uint256", maxUint256 + 1n), /out of range for uint256/);

  // int256 min and max
  const minInt256 = -(1n << 255n);
  const maxInt256 = (1n << 255n) - 1n;
  assert.equal(encodeParam("int256", maxInt256), "7" + "f".repeat(63));
  assert.equal(encodeParam("int256", minInt256), "8" + "0".repeat(63));
  assert.throws(() => encodeParam("int256", minInt256 - 1n), /out of range for int256/);
});

test("encodeParam & validateHexBytes enforce fixed bytes formatting", () => {
  // bytes4 right-padded
  const encodedBytes4 = encodeParam("bytes4", "0x12345678");
  assert.equal(encodedBytes4, "12345678" + "0".repeat(56));

  // bytes32
  const hex32 = "ab".repeat(32);
  assert.equal(encodeParam("bytes32", `0x${hex32}`), hex32);

  // Rejects invalid hex characters
  assert.throws(() => encodeParam("bytes4", "0xZZ112233"), /Invalid hex bytes/);
  // Rejects oversized hex bytes
  assert.throws(() => encodeParam("bytes4", "0x1234567890"), /exceeds maximum 4 bytes/);
  // Fixed bytes require complete, non-empty bytes
  assert.throws(() => encodeParam("bytes4", "0x1"), /even number of hex characters/);
  assert.throws(() => encodeParam("bytes4", "0x"), /must not be empty/);
});

test("encodeParam encodes address to 32-byte hex", () => {
  const encoded = encodeParam("address", "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51");
  assert.equal(encoded.length, 64);
  assert.equal(encoded, "0000000000000000000000002e1c3e80d13b03aac05aeefacc254e26d6fafb51");
});

test("buildCalldata creates full EVM calldata with selector", () => {
  const doc = explainFunction("balanceOf(address)");
  const calldata = buildCalldata(doc, ["0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51"]);
  assert.equal(calldata, "0x70a082310000000000000000000000002e1c3e80d13b03aac05aeefacc254e26d6fafb51");
});

test("decodeReturnData decodes signed integers (int256) correctly", () => {
  const posHex = "0x" + "0".repeat(62) + "2a"; // +42
  assert.equal(decodeReturnData(posHex, [{ type: "int256" }]).decoded, "42");

  const negHex = "0x" + "f".repeat(64); // -1
  assert.equal(decodeReturnData(negHex, [{ type: "int256" }]).decoded, "-1");

  const neg100Hex = "0x" + ((1n << 256n) - 100n).toString(16); // -100
  assert.equal(decodeReturnData(neg100Hex, [{ type: "int256" }]).decoded, "-100");
});

test("decodeReturnData decodes fixed bytes types", () => {
  const hex = "0x" + "12345678" + "0".repeat(56);
  assert.equal(decodeReturnData(hex, [{ type: "bytes4" }]).decoded, "0x12345678");
});

test("decodeReturnData decodes dynamic string", () => {
  const hex = "0x" +
    "0000000000000000000000000000000000000000000000000000000000000020" +
    "0000000000000000000000000000000000000000000000000000000000000004" +
    "50524f5300000000000000000000000000000000000000000000000000000000";
  const decoded = decodeReturnData(hex, [{ type: "string" }]);
  assert.equal(decoded.decoded, "PROS");
});

test("decodeReturnData rejects truncated dynamic strings instead of bytes32 fallback", () => {
  const truncated = "0x" +
    "0000000000000000000000000000000000000000000000000000000000000020" +
    "0000000000000000000000000000000000000000000000000000000000000010" +
    "5052";

  assert.throws(
    () => decodeReturnData(truncated, [{ type: "string" }]),
    /Return data too short for string/
  );
});

test("decodeReturnData decodes boolean", () => {
  const trueHex = "0x0000000000000000000000000000000000000000000000000000000000000001";
  assert.equal(decodeReturnData(trueHex, [{ type: "bool" }]).decoded, true);

  const falseHex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  assert.equal(decodeReturnData(falseHex, [{ type: "bool" }]).decoded, false);
});
