// AI Governance Copilot — endpoint (zero-dependency, Node built-in http).
//
// Two execution actions Glean calls (eng decisions 4A + 5A):
//   POST /assess   read-only  -> { risk_level, why, required_controls, ... }
//   POST /capture  gated write -> re-runs assess() (single source of truth) -> Vanta-styled record
//
// The risk verdict is computed HERE in deterministic code (decision 1A), not in the
// agent prompt — so it's byte-identical every run and unit-testable.
//
// Run: node index.mjs   (PORT env optional, default 8787)

import { createServer } from "node:http";
import { readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
export const PROFILES = JSON.parse(readFileSync(join(__dir, "profiles.json"), "utf8"));
const PORT = process.env.PORT || 8787;

// --- data classification -------------------------------------------------
// call audio / transcripts / customer PII contain regulated personal data.
const REGULATED = new Set(["call_audio", "customer_pii", "customer_data", "pii", "health", "financial"]);
const CONFIDENTIAL = new Set(["confidential", "source_code", "contracts"]);
const INTERNAL = new Set(["internal", "internal_docs"]);
function classify(dataType) {
  const d = String(dataType || "").toLowerCase();
  if (REGULATED.has(d)) return "Regulated-PII";
  if (CONFIDENTIAL.has(d)) return "Confidential";
  if (INTERNAL.has(d)) return "Internal";
  return "Public";
}

// --- onboarding attribute tiers ------------------------------------------
// Which attributes an onboarding decision DEMANDS rises with data sensitivity
// and high-risk use (EU AI Act style). The engine enforces a representative
// subset; docs/onboarding-attributes.html is the full ~55-attribute catalog.
//   Tier 1 (baseline)  -> every tool
//   Tier 2 (sensitive) -> Confidential data
//   Tier 3 (high-risk) -> Regulated-PII, or a high-risk use flag
export function riskTier(dataClass, highRiskUse = false) {
  if (dataClass === "Regulated-PII" || highRiskUse) return 3;
  if (dataClass === "Confidential") return 2;
  return 1;
}
const TIER_ATTRS = {
  1: ["source", "data_residency", "dpa_on_file", "certs", "approval_status", "training_excluded"],
  2: ["sub_processors", "retention_days", "encryption", "dpia_done"],
  3: ["model_type", "training_data_source", "bias_assessment", "human_oversight", "autonomy_level"],
};
export function requiredAttributes(tier) {
  let keys = [];
  for (let t = 1; t <= tier; t++) keys = keys.concat(TIER_ATTRS[t]);
  return keys;
}
// present = answered (a known value). null/undefined/absent = missing.
// empty array or 0 count as answered ("no certs" / "zero retention" are known).
const isPresent = (v) => v !== undefined && v !== null;
export function missingAttributes(profile, tier) {
  const req = requiredAttributes(tier);
  if (!profile) return req; // unknown tool: nothing is answered yet
  return req.filter((k) => !isPresent(profile[k]));
}

// --- the verdict (single source of truth, decision 5A) -------------------
// Rubric (fixed in design review so LOW is reachable for compliant PII vendors):
//   Regulated-PII AND (no DPA OR non-EU residency)              -> HIGH
//   Regulated-PII AND DPA AND EU AND no cert                    -> MEDIUM
//   Regulated-PII AND DPA AND EU AND cert AND approved          -> LOW (approved)
//   Confidential/Internal AND approved                          -> LOW
//   unknown tool / anything else / uncertain                   -> MEDIUM (needs review)
export function assess(profile, dataType, jurisdiction, highRiskUse = false) {
  const dataClass = classify(dataType);
  const tier = riskTier(dataClass, highRiskUse);
  if (!profile) {
    return {
      risk_level: "MEDIUM",
      needs_review: true,
      data_class: dataClass,
      tier,
      why: "No risk profile on file for this tool, so no confident verdict.",
      required_controls: ["Governance team review"],
      missing_attributes: missingAttributes(null, tier),
    };
  }
  const controls = (profile.control_templates || []).map((c) => c.control);
  const hasCert = (profile.certs || []).length > 0;
  const dpa = !!profile.dpa_on_file;
  // GDPR-style residency check is relative to the caller's jurisdiction.
  const euRequired = String(jurisdiction || "EU").toUpperCase().includes("EU");
  const residencyOk = !euRequired || profile.data_residency === "EU";
  const approved = profile.approval_status === "approved";

  let risk_level, needs_review = false, why;

  if (dataClass === "Regulated-PII") {
    if (!dpa || !residencyOk) {
      risk_level = "HIGH";
      const gaps = [
        !dpa && "no DPA on file",
        !residencyOk && `${profile.data_residency} data residency vs ${jurisdiction || "EU"} requirement (GDPR gap)`,
      ].filter(Boolean);
      why = `${dataClass} via ${profile.name}: ${gaps.join(", ")}.`;
    } else if (!hasCert) {
      risk_level = "MEDIUM";
      why = `${dataClass} via ${profile.name}: DPA + EU residency in place, but no SOC 2 / ISO 27001 attestation.`;
    } else if (approved) {
      risk_level = "LOW";
      why = `${dataClass} via ${profile.name}: approved, DPA + EU residency + certified.`;
    } else {
      risk_level = "MEDIUM"; needs_review = true;
      why = `${dataClass} via ${profile.name}: controls in place but not yet approved.`;
    }
  } else if (dataClass === "Confidential" || dataClass === "Internal") {
    if (approved) { risk_level = "LOW"; why = `${dataClass} via ${profile.name}: approved for this data class.`; }
    else { risk_level = "MEDIUM"; needs_review = true; why = `${dataClass} via ${profile.name}: not yet approved.`; }
  } else {
    risk_level = "LOW"; why = `${dataClass} data: low sensitivity.`;
  }

  return { risk_level, needs_review, data_class: dataClass, tier, why,
           required_controls: controls.length ? controls : ["None — cleared for use"],
           missing_attributes: missingAttributes(profile, tier) };
}

// --- record ids ----------------------------------------------------------
let SEQ = 140;
const nextRecordId = () => `VND-2026-${String(++SEQ).padStart(4, "0")}`;

// --- profile -> Vanta record mapping (decision: capture matches verdict) -
function toVantaRecord(profile, verdict) {
  return {
    record_id: nextRecordId(),
    object: "ai_vendor_risk",
    tool: profile.name,
    risk_level: verdict.risk_level,
    risk_justification: verdict.why,
    required_controls: verdict.required_controls,
    owner: "governance@company.com",
    status: verdict.risk_level === "LOW" ? "approved" : "flagged",
    captured_at: new Date().toISOString(),
  };
}

// --- new-tool request intake (docs/intake-workflow.md) -------------------
// A request is a DISTINCT object from a captured verdict: no confident answer yet,
// just a pending item whose open_questions ARE the tier attributes the requester
// hasn't provided (closing the loop with missingAttributes). Reuses assess() for
// the provisional read.
const PROFILE_FIELDS = ["source", "vendor", "data_residency", "certs", "dpa_on_file",
  "training_excluded", "retention_days", "sub_processors", "encryption", "dpia_done",
  "model_type", "training_data_source", "bias_assessment", "human_oversight",
  "autonomy_level", "approval_status"];
const QUESTION = {
  source: "Vendor, internal, or open-source?",
  data_residency: "Where is data stored / processed?",
  dpa_on_file: "Is a signed DPA on file?",
  certs: "SOC 2 Type II / ISO 27001 / ISO 42001?",
  training_excluded: "Is our data excluded from model training?",
  retention_days: "What is the data retention period?",
  sub_processors: "Which sub-processors are in the chain?",
  encryption: "Encryption in transit and at rest?",
  dpia_done: "Has a DPIA / PIA been completed?",
  model_type: "What model powers it (foundation / fine-tuned / agentic)?",
  training_data_source: "Training data source and licensing?",
  bias_assessment: "Has bias been assessed and is it monitored?",
  human_oversight: "Is there human oversight on consequential output?",
  autonomy_level: "Does it suggest only, or take actions?",
  approval_status: "Current approval status?",
};
const CLASS_ORDER = { Public: 0, Internal: 1, Confidential: 2, "Regulated-PII": 3 };
// the most-sensitive data class across the requested data types drives the tier
function classifyMost(dataTypes) {
  let best = "Public", bestType = (dataTypes && dataTypes[0]) || "";
  for (const dt of dataTypes || []) {
    const c = classify(dt);
    if (CLASS_ORDER[c] > CLASS_ORDER[best]) { best = c; bestType = dt; }
  }
  return { dataClass: best, dataType: bestType };
}
const openQuestions = (missingKeys) => missingKeys.map((k) => QUESTION[k] || `Provide ${k}`);

export function buildRequest(body = {}) {
  const { tool, vendor, source, requested_by, department, intended_use,
          data_types, jurisdiction, high_risk_use } = body;
  // treat the request body as a partial profile — only the fields actually provided
  const reqProfile = { name: tool || "the requested tool" };
  for (const f of PROFILE_FIELDS) if (body[f] !== undefined) reqProfile[f] = body[f];
  const { dataClass, dataType } = classifyMost(data_types);
  const tier = riskTier(dataClass, high_risk_use);
  const provisional = assess(reqProfile, dataType, jurisdiction, high_risk_use);
  const missing = missingAttributes(reqProfile, tier); // name isn't a required attr
  return {
    record_id: nextRecordId(),
    object: "ai_vendor_request",
    status: "pending_review",
    tool: tool || null,
    vendor: vendor || null,
    source: source || "vendor",
    requested_by: requested_by || "anonymous",
    department: department || null,
    intended_use: intended_use || null,
    data_types: data_types || [],
    jurisdiction: jurisdiction || "EU",
    data_class: dataClass,
    tier,
    provisional_verdict: `${provisional.risk_level} (provisional)`,
    open_questions: openQuestions(missing),
    owner: "governance@company.com",
    requested_at: new Date().toISOString(),
  };
}

// --- audit trail (CEO finding F1: the moat) ------------------------------
// Every /assess is recorded, not just the decisions someone captures. Demo scope is
// an append-only JSONL event log; a tamper-evident store (RBAC, retention) is roadmap.
// Path is read lazily so tests can redirect it via AUDIT_LOG without re-importing.
const auditPath = () => process.env.AUDIT_LOG || join(__dir, "audit-log.jsonl");
export function recordAudit({ who, tool_id, data_type, jurisdiction, verdict, proceeded }) {
  const entry = {
    ts: new Date().toISOString(),
    who: who || "anonymous",
    tool: tool_id ?? null,
    data: data_type ?? null,
    jurisdiction: jurisdiction ?? null,
    verdict: verdict?.risk_level ?? null, // tolerate a missing/malformed verdict (F2)
    proceeded: proceeded ?? null,         // null = assessed only; true = went on to capture
  };
  try {
    appendFileSync(auditPath(), JSON.stringify(entry) + "\n");
  } catch (e) {
    // An audit-write failure must never crash an assessment (F1). Log and continue.
    console.error(`audit write failed: ${e.message}`);
  }
  return entry;
}
function readAudit(limit = 50) {
  let raw;
  try {
    raw = readFileSync(auditPath(), "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return []; // no log yet — legitimate empty
    console.error(`audit read failed: ${e.message}`);
    return [];
  }
  // Skip/flag a corrupt line rather than blanking the whole trail (F4).
  return raw.trim().split("\n").filter(Boolean).slice(-limit)
    .map((l) => { try { return JSON.parse(l); } catch { return { error: "unparseable", raw: l }; } });
}

// --- HTTP plumbing -------------------------------------------------------
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => {
      b += c;
      if (b.length > 64 * 1024) { req.destroy(); resolve({}); } // F5: cap body, no memory blowup
    });
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
    req.on("error", () => resolve({})); // F5: a mid-upload reset must not crash the server
  });
}
const json = (res, code, obj) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj, null, 2));
};

const server = createServer(async (req, res) => {
  const { method, url } = req;
  if (method === "GET" && url === "/health") return json(res, 200, { ok: true, tools: Object.keys(PROFILES) });
  // The audit trail — the complete record of every AI-use decision (demo beat).
  if (method === "GET" && url === "/audit") return json(res, 200, { entries: readAudit() });

  if (method === "POST" && (url === "/assess" || url === "/capture")) {
    const { tool_id, data_type, jurisdiction, who, high_risk_use } = await readBody(req);
    const profile = PROFILES[tool_id] || null;
    const verdict = assess(profile, data_type, jurisdiction, high_risk_use); // 5A: same fn both endpoints

    if (url === "/assess") {
      recordAudit({ who, tool_id, data_type, jurisdiction, verdict, proceeded: null });
      return json(res, 200, { tool_id, data_type, jurisdiction, ...verdict });
    }

    // /capture is the gated write. The agent only calls this after a user "Yes".
    if (!profile) return json(res, 422, { error: "Cannot capture an unknown tool. Assess a known tool first." });
    recordAudit({ who, tool_id, data_type, jurisdiction, verdict, proceeded: true });
    return json(res, 200, { captured: true, vanta_record: toVantaRecord(profile, verdict) });
  }

  // /request — intake for a NEW/unknown tool. Captures a pending request whose
  // open_questions are the tier attributes the requester didn't provide.
  if (method === "POST" && url === "/request") {
    const body = await readBody(req);
    const record = buildRequest(body);
    recordAudit({
      who: body.requested_by || body.who, tool_id: body.tool,
      data_type: record.data_types[0] || null, jurisdiction: record.jurisdiction,
      verdict: { risk_level: record.provisional_verdict }, proceeded: "requested",
    });
    return json(res, 200, { requested: true, vanta_record: record });
  }

  json(res, 404, { error: "not found", routes: ["GET /health", "GET /audit", "POST /assess", "POST /capture", "POST /request"] });
});

// Only start the server when run directly (so tests can import assess() without a listen).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  server.listen(PORT, () => console.log(`governance endpoint on :${PORT} (tools: ${Object.keys(PROFILES).join(", ")})`));
}
