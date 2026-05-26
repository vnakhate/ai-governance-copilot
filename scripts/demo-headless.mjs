// Dual-surface demo (CEO finding CT1): prove "one engine, many surfaces".
//
// The Glean chat agent calls /assess + /capture. So does this script — standing in for
// a NON-chat surface (a procurement intake form, a CI check, an automation job). Same
// engine, same deterministic verdict, same Vanta record. Chat is just client #1.
//
// Usage: start the endpoint first (cd endpoint && npm start), then:
//   node scripts/demo-headless.mjs
// Optional: BASE_URL=https://<ngrok>.ngrok-free.app node scripts/demo-headless.mjs

const BASE = process.env.BASE_URL || "http://localhost:8787";
const scenario = { tool_id: "acme-notetaker", data_type: "call_audio", jurisdiction: "EU", who: "procurement-bot" };

const line = (s = "") => process.stdout.write(s + "\n");
const rule = () => line("─".repeat(64));

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`${path} -> ${r.status}: ${t}`);
  }
  return r.json();
}

try {
  rule();
  line("SURFACE 2 — headless (procurement intake / CI / automation)");
  line(`engine: ${BASE}   (the SAME endpoint the Glean chat agent calls)`);
  rule();
  line(`Request:  ${JSON.stringify(scenario)}`);
  line();

  const verdict = await post("/assess", scenario);
  line(`Verdict:  ${verdict.risk_level}  (${verdict.data_class})`);
  line(`Why:      ${verdict.why}`);
  line(`Controls: ${verdict.required_controls.join("  ·  ")}`);
  line();

  line("Proceeding to onboard (the 'Yes') ...");
  const captured = await post("/capture", scenario);
  const v = captured.vanta_record;
  line(`Vanta:    ${v.record_id}  [${v.status}]  risk=${v.risk_level}`);
  line(`          owner ${v.owner} notified`);
  rule();
  line("Identical to the chat path. One engine. Every surface. Logged in the audit trail.");
  rule();
} catch (e) {
  line(`\n⚠️  Could not reach the engine at ${BASE}`);
  line(`    Start it first:  cd endpoint && npm start`);
  line(`    (${e.message})`);
  process.exit(1);
}
