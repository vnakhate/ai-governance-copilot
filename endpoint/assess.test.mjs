// Unit tests for the deterministic risk rubric (decision 1A).
// Run: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assess, PROFILES, recordAudit } from "./index.mjs";

const acme = PROFILES["acme-notetaker"];
const noteflow = PROFILES["noteflow-eu"];
const claude = PROFILES["claude-bedrock-internal"];

test("HIGH: Regulated-PII + no DPA / non-EU residency", () => {
  const v = assess(acme, "call_audio", "EU");
  assert.equal(v.risk_level, "HIGH");
  assert.deepEqual(v.required_controls, ["Signed DPA required", "EU data residency", "Retention < 30 days"]);
});

test("MEDIUM: Regulated-PII + DPA + EU + no cert", () => {
  const v = assess(noteflow, "customer_pii", "EU");
  assert.equal(v.risk_level, "MEDIUM");
  assert.equal(v.needs_review, false);
});

test("LOW: Regulated-PII + DPA + EU + cert + approved", () => {
  const v = assess(claude, "customer_pii", "EU");
  assert.equal(v.risk_level, "LOW");
});

test("MEDIUM needs_review: unknown tool", () => {
  const v = assess(null, "customer_pii", "EU");
  assert.equal(v.risk_level, "MEDIUM");
  assert.equal(v.needs_review, true);
});

test("Public data is LOW regardless of tool gaps", () => {
  const v = assess(acme, "marketing_copy", "EU");
  assert.equal(v.data_class, "Public");
  assert.equal(v.risk_level, "LOW");
});

test("Jurisdiction matters: US-residency tool is fine for a US caller", () => {
  // acme is US-residency; for a US jurisdiction there's no cross-border gap,
  // but it still lacks a DPA -> remains HIGH on the DPA gap alone.
  const v = assess(acme, "customer_pii", "US");
  assert.equal(v.risk_level, "HIGH");
  assert.match(v.why, /no DPA/);
  assert.doesNotMatch(v.why, /GDPR gap/);
});

test("audit: recordAudit appends a JSONL line capturing the decision", () => {
  const dir = mkdtempSync(join(tmpdir(), "gov-audit-"));
  process.env.AUDIT_LOG = join(dir, "audit.jsonl");
  try {
    const v = assess(PROFILES["acme-notetaker"], "call_audio", "EU");
    const entry = recordAudit({ who: "tester", tool_id: "acme-notetaker", data_type: "call_audio", jurisdiction: "EU", verdict: v, proceeded: null });
    assert.equal(entry.verdict, "HIGH");
    assert.equal(entry.proceeded, null);
    const lines = readFileSync(process.env.AUDIT_LOG, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const row = JSON.parse(lines[0]);
    assert.equal(row.tool, "acme-notetaker");
    assert.equal(row.verdict, "HIGH");
    assert.equal(row.who, "tester");
    assert.ok(row.ts, "has a timestamp");
  } finally {
    delete process.env.AUDIT_LOG;
    rmSync(dir, { recursive: true, force: true });
  }
});
