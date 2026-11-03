// src/format.mjs — Formatting & Terminal Report Generator
export function formatUnits(rawAmount, decimals = 18) {
  if (rawAmount === null || rawAmount === undefined) return "0";
  const rawStr = String(rawAmount);
  if (!/^\d+$/.test(rawStr)) return rawStr;
  const dec = Number(decimals) || 0;
  if (dec === 0) return rawStr;

  const padded = rawStr.padStart(dec + 1, "0");
  const integerPart = padded.slice(0, padded.length - dec);
  let fractionPart = padded.slice(padded.length - dec).replace(/0+$/, "");
  return fractionPart.length > 0 ? `${integerPart}.${fractionPart}` : integerPart;
}

export function renderAgentReport(result) {
  const lines = [];
  const sep = () => lines.push("═".repeat(68));
  const thin = () => lines.push("─".repeat(68));

  lines.push("");
  sep();
  lines.push("  PHAROS DOCS MCP + CHAIN MCP AGENT REPORT");
  sep();

  lines.push(`  Execution Status:   ${result.success ? "SUCCESS" : "FAILED"}`);
  lines.push(`  Target Contract:    ${result.targetContract}`);
  lines.push(`  Network / Chain:    ${result.network?.networkName || "Pharos Mainnet"} (Chain ID: ${result.network?.chainId || 1672})`);
  lines.push(`  Pinned Block:       #${result.pinnedBlock || "N/A"}`);
  lines.push(`  Timestamp (UTC):    ${result.timestamp}`);
  thin();

  lines.push("  [STEP 1: DEVELOPER DOCS GROUNDING]");
  lines.push(`  Function Signature: ${result.doc?.signature}`);
  lines.push(`  Standard Category:  ${result.doc?.standard} — ${result.doc?.category}`);
  lines.push(`  Selector:           ${result.doc?.selector}`);
  lines.push(`  State Mutability:   ${result.doc?.stateMutability}`);
  lines.push(`  Summary:            ${result.doc?.summary}`);
  if (result.doc?.securityNotes) {
    lines.push(`  Security Notes:     ${result.doc?.securityNotes}`);
  }
  thin();

  lines.push("  [STEP 2: CALLDATA SYNTHESIS & INPUT VALIDATION]");
  lines.push(`  Input Arguments:    ${JSON.stringify(result.args)}`);
  lines.push(`  Synthesized Calldata: ${result.calldata}`);
  thin();

  lines.push("  [STEP 3: CHAIN MCP ON-CHAIN EXECUTION]");
  lines.push(`  MCP Server:         ${result.mcpEndpoint}`);
  lines.push(`  Bytecode Verified:  ${result.bytecodeVerified ? "YES (Active Contract Code Detected)" : "NO"}`);
  lines.push(`  Raw Return Hex:     ${result.rawReturn}`);
  lines.push(`  Decoded Value:      ${result.formattedValue}`);
  if (result.scaledValue) {
    lines.push(`  Scaled Value:       ${result.scaledValue}`);
  }
  thin();

  lines.push("  [STEP 4: AGENT VERIFICATION TRACE]");
  for (const trace of result.traces || []) {
    lines.push(`  • [${trace.step}] ${trace.message}`);
  }
  sep();
  lines.push("");

  return lines.join("\n");
}
