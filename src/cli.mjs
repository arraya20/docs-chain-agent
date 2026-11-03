#!/usr/bin/env node
// src/cli.mjs — Pharos Docs MCP + Chain MCP Agent CLI
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runDocsChainAgent } from "./agent.mjs";
import { explainFunction, searchDocs, CONTRACT_DOCS } from "./docs-kb.mjs";
import { renderAgentReport } from "./format.mjs";
import { DEFAULT_CHAIN_MCP_URL } from "./mcp.mjs";

function printUsage() {
  console.log(`
Pharos Docs MCP + Chain MCP Agent CLI
======================================
Autonomous Developer Docs grounding, Calldata Synthesis, and Live Chain MCP Execution.

Usage:
  node src/cli.mjs [command] [options]

Commands:
  (no args)                                 Interactive agent prompt
  run <contract> <function> [args...]       Explain function and execute via Chain MCP
  explain <function>                        Query Developer Docs and explain contract function
  search <keyword>                          Search Developer Docs knowledge base
  list                                      List all documented standards & standard functions

Options:
  --json                                    Output raw structured JSON
  --allow-eoa, --raw-probe                  Allow executing eth_call even if target has no deployed bytecode
  --mcp <URL>                               Custom Chain MCP endpoint (default: ${DEFAULT_CHAIN_MCP_URL})
  -h, --help                                Show this help message

Examples:
  node src/cli.mjs explain "allowance(address,address)"
  node src/cli.mjs search "permit"
  node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 totalSupply
  node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 balanceOf 0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51
  node src/cli.mjs run 0x6b0a44c64190279f7034b77c13a566e914fe5ec4 allowance 0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51 0x000000000022D473030F116dDEE9F6B43aC78BA3 --json
`.trim());
}

async function runInteractive() {
  const rl = createInterface({ input, output });
  try {
    console.log("\n🤖 Pharos Docs MCP + Chain MCP Agent (Interactive Mode)\n");

    const contract = await rl.question("Enter Target Contract Address (0x...): ");
    if (!contract.trim()) {
      console.error("Contract address is required.");
      process.exit(1);
    }

    console.log("\nCommon standard functions: totalSupply, balanceOf(address), allowance(address,address), name, symbol, decimals, owner, paused");
    const fnQuery = await rl.question("Enter Function Name or Signature: ");
    if (!fnQuery.trim()) {
      console.error("Function name or signature is required.");
      process.exit(1);
    }

    // Explain first
    const doc = explainFunction(fnQuery.trim());
    console.log(`\n📚 [Docs Grounding] Found: ${doc.signature} (${doc.standard})`);
    console.log(`Summary: ${doc.summary}`);

    const args = [];
    for (let i = 0; i < (doc.inputs || []).length; i++) {
      const inp = doc.inputs[i];
      const val = await rl.question(`Enter argument ${i + 1}/${doc.inputs.length} [${inp.name}: ${inp.type}]: `);
      args.push(val.trim());
    }

    console.log("\n⏳ Grounding docs & executing on-chain via Pharos Chain MCP...\n");
    const result = await runDocsChainAgent({
      contractAddress: contract.trim(),
      functionQuery: fnQuery.trim(),
      args
    });

    console.log(renderAgentReport(result));
  } catch (err) {
    console.error(`\n❌ Agent Error: ${err.message}\n`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  const isJson = rawArgs.includes("--json");
  const allowEoa = rawArgs.includes("--allow-eoa") || rawArgs.includes("--raw-probe");
  const filteredArgs = rawArgs.filter(a => a !== "--json" && a !== "--allow-eoa" && a !== "--raw-probe");

  let mcpUrl = DEFAULT_CHAIN_MCP_URL;
  const mcpIdx = filteredArgs.indexOf("--mcp");
  if (mcpIdx !== -1 && filteredArgs[mcpIdx + 1]) {
    mcpUrl = filteredArgs[mcpIdx + 1];
    filteredArgs.splice(mcpIdx, 2);
  }

  if (filteredArgs.length === 0) {
    await runInteractive();
    return;
  }

  const cmd = filteredArgs[0];

  if (cmd === "list") {
    const list = Object.values(CONTRACT_DOCS);
    if (isJson) {
      console.log(JSON.stringify(list, null, 2));
    } else {
      console.log("\n📚 Documented Contract Standards & Standard Signatures:\n");
      for (const d of list) {
        console.log(`• ${d.signature.padEnd(32)} [${d.selector}] — ${d.standard} (${d.category})`);
      }
      console.log("");
    }
    return;
  }

  if (cmd === "search") {
    const q = filteredArgs.slice(1).join(" ");
    const matches = searchDocs(q);
    if (isJson) {
      console.log(JSON.stringify(matches, null, 2));
    } else {
      console.log(`\n🔍 Docs Search Results for "${q}" (${matches.length} found):\n`);
      for (const m of matches) {
        console.log(`• ${m.signature} [${m.standard}]`);
        console.log(`  Summary: ${m.summary}\n`);
      }
    }
    return;
  }

  if (cmd === "explain") {
    const fnQ = filteredArgs[1];
    if (!fnQ) {
      console.error("Function name or signature required for explain command.");
      process.exit(1);
    }
    try {
      const doc = explainFunction(fnQ);
      if (isJson) {
        console.log(JSON.stringify(doc, null, 2));
      } else {
        console.log(`\n📚 Developer Docs Explanation for: ${doc.signature}\n`);
        console.log(`Standard:         ${doc.standard}`);
        console.log(`Category:         ${doc.category}`);
        console.log(`Selector:         ${doc.selector}`);
        console.log(`State Mutability: ${doc.stateMutability}`);
        console.log(`Summary:          ${doc.summary}`);
        if (doc.inputs.length) {
          console.log("\nInputs:");
          for (const inp of doc.inputs) {
            console.log(`  - ${inp.name} (${inp.type}): ${inp.description}`);
          }
        }
        if (doc.outputs.length) {
          console.log("\nOutputs:");
          for (const out of doc.outputs) {
            console.log(`  - ${out.name} (${out.type}): ${out.description}`);
          }
        }
        if (doc.securityNotes) console.log(`\nSecurity Notes:   ${doc.securityNotes}`);
        console.log("");
      }
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}\n`);
      process.exit(1);
    }
    return;
  }

  if (cmd === "run") {
    const contract = filteredArgs[1];
    const fnQ = filteredArgs[2];
    const callArgs = filteredArgs.slice(3);

    if (!contract || !fnQ) {
      console.error("Both target contract address and function query are required for run command.");
      printUsage();
      process.exit(1);
    }

    try {
      const result = await runDocsChainAgent({
        contractAddress: contract,
        functionQuery: fnQ,
        args: callArgs,
        mcpUrl,
        allowEoa
      });

      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(renderAgentReport(result));
      }
    } catch (err) {
      if (isJson) {
        console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
      } else {
        console.error(`\n❌ Agent Execution Failed: ${err.message}\n`);
      }
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  printUsage();
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
