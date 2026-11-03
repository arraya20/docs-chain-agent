// public/app.js — Client-side agent controller
document.addEventListener("DOMContentLoaded", () => {
  const PRESETS = {
    totalSupply: {
      contract: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      func: "totalSupply",
      args: []
    },
    balanceOf: {
      contract: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      func: "balanceOf(address)",
      args: [{ name: "account", label: "Account Address (EVM)", placeholder: "0x...", value: "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51" }]
    },
    allowance: {
      contract: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      func: "allowance(address,address)",
      args: [
        { name: "owner", label: "Owner Address", placeholder: "0x...", value: "0x2e1c3e80d13b03aac05aeefacc254e26d6fafb51" },
        { name: "spender", label: "Spender Address", placeholder: "0x...", value: "0x000000000022D473030F116dDEE9F6B43aC78BA3" }
      ]
    },
    symbol: {
      contract: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      func: "symbol",
      args: []
    },
    owner: {
      contract: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      func: "owner",
      args: []
    },
    paused: {
      contract: "0x6b0a44c64190279f7034b77c13a566e914fe5ec4",
      func: "paused",
      args: []
    }
  };

  const form = document.getElementById("agentForm");
  const contractInput = document.getElementById("contractAddress");
  const funcInput = document.getElementById("functionQuery");
  const argsContainer = document.getElementById("argsContainer");
  const btnExplain = document.getElementById("btnExplain");
  const btnExecute = document.getElementById("btnExecute");
  const presetBtns = document.querySelectorAll(".preset-btn");

  const statusIndicator = document.getElementById("statusIndicator");
  const loadingState = document.getElementById("loadingState");
  const loadingText = document.getElementById("loadingText");
  const emptyState = document.getElementById("emptyState");
  const agentOutput = document.getElementById("agentOutput");

  // Output elements
  const docStandardBadge = document.getElementById("docStandardBadge");
  const evidenceContract = document.getElementById("evidenceContract");
  const docSignature = document.getElementById("docSignature");
  const docSelector = document.getElementById("docSelector");
  const docSummary = document.getElementById("docSummary");
  const docSecurity = document.getElementById("docSecurity");
  const securityNotesRow = document.getElementById("securityNotesRow");

  const callArgs = document.getElementById("callArgs");
  const callDataHex = document.getElementById("callDataHex");

  const blockHeightBadge = document.getElementById("blockHeightBadge");
  const bytecodeStatus = document.getElementById("bytecodeStatus");
  const rawReturnHex = document.getElementById("rawReturnHex");
  const decodedValueText = document.getElementById("decodedValueText");
  const scaledValueText = document.getElementById("scaledValueText");
  const traceList = document.getElementById("traceList");

  function setStatus(type, text) {
    statusIndicator.replaceChildren();
    const pill = document.createElement("span");
    pill.className = `status-pill status-${type}`;
    pill.textContent = text;
    statusIndicator.appendChild(pill);
  }

  function renderTraceItem(tag, message) {
    const li = document.createElement("li");
    li.className = "trace-item";

    const tagSpan = document.createElement("span");
    tagSpan.className = "trace-tag";
    tagSpan.textContent = tag;

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;

    li.appendChild(tagSpan);
    li.appendChild(msgSpan);
    return li;
  }

  function renderArgs(argsSpec = []) {
    argsContainer.replaceChildren();
    if (!argsSpec || argsSpec.length === 0) return;

    argsSpec.forEach((arg, index) => {
      const group = document.createElement("div");
      group.className = "form-group";

      const label = document.createElement("label");
      label.htmlFor = `arg_${index}`;
      label.textContent = arg.label || arg.name || `Argument ${index + 1}`;

      const input = document.createElement("input");
      input.type = "text";
      input.id = `arg_${index}`;
      input.className = "arg-input";
      input.dataset.index = String(index);
      input.placeholder = arg.placeholder || "Value";
      input.value = arg.value || "";
      input.required = true;
      input.autocomplete = "off";
      input.spellcheck = false;

      group.appendChild(label);
      group.appendChild(input);
      argsContainer.appendChild(group);
    });
  }

  function getArgsValues() {
    const inputs = argsContainer.querySelectorAll(".arg-input");
    return Array.from(inputs).map(inp => inp.value.trim());
  }

  // Preset click
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const key = btn.dataset.preset;
      const preset = PRESETS[key];
      if (preset) {
        contractInput.value = preset.contract;
        funcInput.value = preset.func;
        renderArgs(preset.args);
      }
    });
  });

  // Dynamic input detection on typing function signature
  funcInput.addEventListener("blur", async () => {
    const q = funcInput.value.trim();
    if (!q) return;

    try {
      const res = await fetch(`/api/explain?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const doc = await res.json();
        if (doc.inputs && doc.inputs.length > 0) {
          const currentArgs = getArgsValues();
          const spec = doc.inputs.map((inp, idx) => ({
            name: inp.name,
            label: `${inp.name} (${inp.type})`,
            placeholder: `Enter ${inp.type}`,
            value: currentArgs[idx] || ""
          }));
          renderArgs(spec);
        } else {
          renderArgs([]);
        }
      }
    } catch {
      // Ignore background preview failures
    }
  });

  // Explain-only button
  btnExplain.addEventListener("click", async () => {
    const q = funcInput.value.trim();
    if (!q) {
      alert("Please enter a function name or signature.");
      return;
    }

    setStatus("running", "Explaining...");
    loadingText.textContent = "Querying Developer Docs Knowledge Base...";
    loadingState.classList.remove("hidden");
    emptyState.classList.add("hidden");
    agentOutput.classList.add("hidden");

    try {
      const res = await fetch(`/api/explain?q=${encodeURIComponent(q)}`);
      const doc = await res.json();

      if (!res.ok || doc.error) {
        throw new Error(doc.error || "Documentation query failed");
      }

      // Populate Docs Section
      docStandardBadge.textContent = doc.standard || "Custom";
      docSignature.textContent = doc.signature;
      docSelector.textContent = doc.selector;
      docSummary.textContent = doc.summary;

      if (doc.securityNotes) {
        docSecurity.textContent = doc.securityNotes;
        securityNotesRow.classList.remove("hidden");
      } else {
        securityNotesRow.classList.add("hidden");
      }

      callArgs.textContent = JSON.stringify(getArgsValues());
      callDataHex.textContent = doc.selector + "... (run pipeline to synthesize full calldata)";

      blockHeightBadge.textContent = "Docs Grounding Only";
      bytecodeStatus.textContent = "Pending Run";
      rawReturnHex.textContent = "Pending Run";
      decodedValueText.textContent = "Ready for execution";
      scaledValueText.textContent = "";

      traceList.replaceChildren(
        renderTraceItem("DOCS_GROUNDED", `Matched function signature ${doc.signature} in Developer Docs.`)
      );

      loadingState.classList.add("hidden");
      agentOutput.classList.remove("hidden");
      setStatus("success", "Docs Grounded");
    } catch (err) {
      loadingState.classList.add("hidden");
      emptyState.classList.remove("hidden");
      setStatus("error", "Error");
      alert(`Docs Error: ${err.message}`);
    }
  });

  // Execute full agent pipeline
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const contractAddress = contractInput.value.trim();
    const functionQuery = funcInput.value.trim();
    const args = getArgsValues();

    if (!contractAddress || !functionQuery) {
      alert("Contract address and function query are required.");
      return;
    }

    setStatus("running", "Executing...");
    loadingText.textContent = "Composing Developer Docs & Executing Chain MCP...";
    loadingState.classList.remove("hidden");
    emptyState.classList.add("hidden");
    agentOutput.classList.add("hidden");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress, functionQuery, args })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Agent execution failed");
      }

      // Step 1: Docs
      evidenceContract.textContent = data.targetContract || contractAddress;
      docStandardBadge.textContent = data.doc?.standard || "Standard";
      docSignature.textContent = data.doc?.signature || functionQuery;
      docSelector.textContent = data.doc?.selector || "—";
      docSummary.textContent = data.doc?.summary || "—";

      if (data.doc?.securityNotes) {
        docSecurity.textContent = data.doc.securityNotes;
        securityNotesRow.classList.remove("hidden");
      } else {
        securityNotesRow.classList.add("hidden");
      }

      // Step 2: Calldata
      callArgs.textContent = JSON.stringify(data.args || []);
      callDataHex.textContent = data.calldata || "—";

      // Step 3: Execution
      blockHeightBadge.textContent = `Block #${data.pinnedBlock || "N/A"}`;
      bytecodeStatus.textContent = data.bytecodeVerified ? "Active Contract Bytecode Verified" : "No Bytecode Detected (EOA)";
      rawReturnHex.textContent = data.rawReturn || "0x";
      decodedValueText.textContent = data.formattedValue || String(data.decodedValue) || "—";
      scaledValueText.textContent = data.scaledValue ? `Scaled: ${data.scaledValue}` : "";

      // Step 4: Traces
      traceList.replaceChildren();
      (data.traces || []).forEach(tr => {
        traceList.appendChild(renderTraceItem(tr.step, tr.message));
      });

      loadingState.classList.add("hidden");
      agentOutput.classList.remove("hidden");
      setStatus("success", "Completed");
    } catch (err) {
      loadingState.classList.add("hidden");
      emptyState.classList.remove("hidden");
      setStatus("error", "Execution Failed");
      alert(`Agent Error: ${err.message}`);
    }
  });

  // Initial preset
  renderArgs([]);
});
