// src/abi.mjs — Zero-dependency ABI encoding, decoding, and validation

export function isValidAddress(address) {
  return typeof address === "string" && /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

export function normalizeAddress(address) {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid EVM address: ${address}`);
  }
  return address.trim().toLowerCase();
}

/**
 * Parse and validate integer type specification (uintM / intM).
 * Returns { isSigned: boolean, bits: number }
 */
export function parseIntegerType(type) {
  const norm = type.toLowerCase().trim();
  const match = norm.match(/^(u?int)(\d+)?$/);
  if (!match) return null;

  const isSigned = match[1] === "int";
  const bits = match[2] !== undefined ? Number(match[2]) : 256;

  if (bits < 8 || bits > 256 || bits % 8 !== 0) {
    throw new Error(`Invalid integer bit width for ${type}: must be between 8 and 256 in multiples of 8`);
  }

  return { isSigned, bits };
}

/**
 * Parse and validate fixed bytes type specification (bytesN).
 * Returns { bytesLength: number }
 */
export function parseBytesType(type) {
  const norm = type.toLowerCase().trim();
  const match = norm.match(/^bytes(\d+)$/);
  if (!match) return null;

  const bytesLength = Number(match[1]);
  if (bytesLength < 1 || bytesLength > 32) {
    throw new Error(`Invalid bytes length for ${type}: must be between 1 and 32`);
  }

  return { bytesLength };
}

/**
 * Validate and compute bounds for integer types.
 */
export function validateIntegerRange(value, isSigned, bits) {
  let bigVal;
  try {
    if (typeof value === "bigint") {
      bigVal = value;
    } else if (typeof value === "number") {
      if (!Number.isInteger(value)) {
        throw new Error(`Floating point numbers not allowed for integer types: ${value}`);
      }
      bigVal = BigInt(value);
    } else {
      const str = String(value).trim();
      if (!str || !/^-?(0x[0-9a-fA-F]+|\d+)$/.test(str)) {
        throw new Error(`Invalid integer format: "${value}"`);
      }
      bigVal = BigInt(str);
    }
  } catch (err) {
    throw new Error(`Invalid integer parameter value: ${err.message}`);
  }

  if (isSigned) {
    const min = -(1n << BigInt(bits - 1));
    const max = (1n << BigInt(bits - 1)) - 1n;
    if (bigVal < min || bigVal > max) {
      throw new Error(`Value ${bigVal} out of range for int${bits} [${min}, ${max}]`);
    }
  } else {
    const min = 0n;
    const max = (1n << BigInt(bits)) - 1n;
    if (bigVal < min || bigVal > max) {
      throw new Error(`Value ${bigVal} out of range for uint${bits} [${min}, ${max}]`);
    }
  }

  return bigVal;
}

/**
 * Validate fixed hex bytes string.
 */
export function validateHexBytes(value, expectedBytes) {
  let clean = String(value ?? "").trim();
  if (clean.startsWith("0x") || clean.startsWith("0X")) {
    clean = clean.slice(2);
  }
  if (!/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error(`Invalid hex bytes characters in "${value}"`);
  }
  if (!clean.length) {
    throw new Error(`Hex byte string "${value}" must not be empty`);
  }
  if (clean.length % 2 !== 0) {
    throw new Error(`Hex byte string "${value}" must have an even number of hex characters`);
  }
  const maxHexChars = expectedBytes * 2;
  if (clean.length > maxHexChars) {
    throw new Error(`Hex byte string "${value}" exceeds maximum ${expectedBytes} bytes (${maxHexChars} hex chars)`);
  }
  return clean;
}

/**
 * Encode an individual parameter value to a 32-byte EVM word (hex string without 0x prefix).
 */
export function encodeParam(type, value) {
  const normType = type.toLowerCase().trim();

  // 1. address
  if (normType === "address") {
    if (!isValidAddress(value)) {
      throw new Error(`Invalid address parameter value: ${value}`);
    }
    const clean = value.trim().toLowerCase().replace(/^0x/, "");
    return clean.padStart(64, "0");
  }

  // 2. uintM / intM (integer width & signed two's complement encoding)
  const intSpec = parseIntegerType(normType);
  if (intSpec) {
    const { isSigned, bits } = intSpec;
    const bigVal = validateIntegerRange(value, isSigned, bits);

    if (bigVal >= 0n) {
      const hex = bigVal.toString(16);
      return hex.padStart(64, "0");
    }

    // Two's complement for negative signed integer sign-extended to 256-bit EVM word
    const twosComplement = (1n << 256n) + bigVal;
    return twosComplement.toString(16).padStart(64, "0");
  }

  // 3. bool
  if (normType === "bool") {
    if (typeof value === "boolean") {
      return value ? "0".repeat(63) + "1" : "0".repeat(64);
    }
    const str = String(value).trim().toLowerCase();
    if (str === "true" || str === "1") {
      return "0".repeat(63) + "1";
    }
    if (str === "false" || str === "0") {
      return "0".repeat(64);
    }
    throw new Error(`Invalid boolean parameter value: ${value}`);
  }

  // 4. bytes1..bytes32
  const bytesSpec = parseBytesType(normType);
  if (bytesSpec) {
    const clean = validateHexBytes(value, bytesSpec.bytesLength);
    // Fixed bytes in EVM ABI are right-padded to 32 bytes (64 hex chars)
    return clean.padEnd(64, "0");
  }

  throw new Error(`Unsupported parameter type for encoding: ${type}`);
}

/**
 * Build EVM calldata from function doc and arguments array.
 */
export function buildCalldata(functionDoc, args = []) {
  const selector = functionDoc.selector.replace(/^0x/, "");
  const inputs = functionDoc.inputs || [];

  if (args.length !== inputs.length) {
    throw new Error(`Argument count mismatch for ${functionDoc.signature}: expected ${inputs.length}, received ${args.length}`);
  }

  let encodedParams = "";
  for (let i = 0; i < inputs.length; i++) {
    const inputSpec = inputs[i];
    const val = args[i];
    encodedParams += encodeParam(inputSpec.type, val);
  }

  return `0x${selector}${encodedParams}`;
}

/**
 * Decode return data from eth_call given the expected output specification.
 */
export function decodeReturnData(hexData, outputs = []) {
  if (!hexData || hexData === "0x" || hexData === "0x0") {
    return { raw: hexData, decoded: null, empty: true };
  }

  const clean = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
  if (!clean.length) {
    return { raw: hexData, decoded: null, empty: true };
  }

  // If no output specification or raw_bytes, return raw hex
  if (!outputs.length || (outputs.length === 1 && outputs[0].type === "raw_bytes")) {
    return { raw: `0x${clean}`, decoded: `0x${clean}`, formatted: `0x${clean}` };
  }

  const firstOutput = outputs[0];
  const type = firstOutput.type.toLowerCase();

  // 1. address
  if (type === "address") {
    if (clean.length < 64) throw new Error("Return data too short for address");
    const addrHex = `0x${clean.slice(24, 64)}`;
    return {
      raw: `0x${clean}`,
      decoded: addrHex,
      formatted: addrHex
    };
  }

  // 2. uintM / intM
  const intSpec = parseIntegerType(type);
  if (intSpec) {
    if (clean.length < 64) throw new Error(`Return data too short for ${type}`);
    const word = clean.slice(0, 64);
    const unsignedVal = BigInt(`0x${word}`);

    if (intSpec.isSigned) {
      // Check sign bit at 256th bit
      const isNegative = unsignedVal >= (1n << 255n);
      const signedVal = isNegative ? unsignedVal - (1n << 256n) : unsignedVal;
      return {
        raw: `0x${clean}`,
        decoded: signedVal.toString(),
        formatted: signedVal.toString()
      };
    }

    return {
      raw: `0x${clean}`,
      decoded: unsignedVal.toString(),
      formatted: unsignedVal.toString()
    };
  }

  // 3. bytes1..bytes32
  const bytesSpec = parseBytesType(type);
  if (bytesSpec) {
    if (clean.length < 64) throw new Error(`Return data too short for ${type}`);
    const hexSlice = `0x${clean.slice(0, bytesSpec.bytesLength * 2)}`;
    return {
      raw: `0x${clean}`,
      decoded: hexSlice,
      formatted: hexSlice
    };
  }

  // 4. bool
  if (type === "bool") {
    if (clean.length < 64) throw new Error("Return data too short for bool");
    const isTrue = BigInt(`0x${clean.slice(0, 64)}`) !== 0n;
    return {
      raw: `0x${clean}`,
      decoded: isTrue,
      formatted: isTrue ? "true" : "false"
    };
  }

  // 5. string (with fallback for legacy bytes32 strings)
  if (type === "string") {
    // Standard dynamic ABI string: offset (32 bytes) + length (32 bytes) + data
    if (clean.length >= 128) {
      try {
        const offset = Number(BigInt(`0x${clean.slice(0, 64)}`));
        if (offset === 32 && clean.length >= 128) {
          const length = Number(BigInt(`0x${clean.slice(64, 128)}`));
          const hexChars = length * 2;
          if (clean.length < 128 + hexChars) {
            throw new Error("Return data too short for string");
          }
          const strHex = clean.slice(128, 128 + hexChars);
          const buffer = Buffer.from(strHex, "hex");
          const decodedStr = buffer.toString("utf8").replace(/\0+$/, "");
          return {
            raw: `0x${clean}`,
            decoded: decodedStr,
            formatted: `"${decodedStr}"`
          };
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Return data too short for string") {
          throw error;
        }
        // Fallback to bytes32 decoding below
      }
    }

    // Legacy bytes32 string fallback
    try {
      const buffer = Buffer.from(clean.slice(0, 64), "hex");
      const decodedStr = buffer.toString("utf8").replace(/\0+$/, "").trim();
      return {
        raw: `0x${clean}`,
        decoded: decodedStr,
        formatted: `"${decodedStr}" (bytes32 fallback)`
      };
    } catch {
      return { raw: `0x${clean}`, decoded: `0x${clean}`, formatted: `0x${clean}` };
    }
  }

  return { raw: `0x${clean}`, decoded: `0x${clean}`, formatted: `0x${clean}` };
}
