# Data Classification Standard

> Index alongside the AI Acceptable Use Policy. The four levels map 1:1 to the labels the
> risk endpoint's `classify()` returns, so the agent and the verdict speak the same language.

## The four levels

### Public
Information cleared for public release. No harm if disclosed.
Examples: published marketing copy, public docs, press releases.
→ AI use: any approved tool (AUP §3.1).

### Internal
Day-to-day business information not meant for the public, low harm if leaked.
Examples: internal wikis, routine email, non-sensitive project notes.
→ AI use: approved tools only (AUP §3.1).

### Confidential
Sensitive business information; material harm if disclosed.
Examples: source code, contracts, unreleased plans, financial forecasts.
→ AI use: approved enterprise deployment with data isolation (AUP §3.3).

### Regulated-PII
Personal or regulated data carrying legal/compliance obligations (GDPR, HIPAA, PCI).
Examples: **customer call audio and transcripts**, customer PII, health data, payment data,
financial records.
→ AI use: only tools meeting all of AUP §3.2 (DPA + approved residency + SOC 2/ISO + limited
retention + training exclusion).

## Mapping to the risk endpoint (`endpoint/index.mjs` → `classify()`)
| Input `data_type` value | Class |
|---|---|
| `call_audio`, `customer_pii`, `customer_data`, `pii`, `health`, `financial` | Regulated-PII |
| `confidential`, `source_code`, `contracts` | Confidential |
| `internal`, `internal_docs` | Internal |
| anything else (e.g. `marketing_copy`) | Public |

## Why call audio is Regulated-PII (defend if challenged)
Recordings and transcripts of customer calls contain customer voice plus likely PII spoken
aloud (names, account numbers, health or financial details). Under GDPR/CCPA that is
regulated personal data — so a notetaker ingesting customer calls handles Regulated-PII,
which is why it triggers AUP §3.2.
