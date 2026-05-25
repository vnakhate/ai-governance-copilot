# AI Acceptable Use Policy

> Index this into Glean as the agent's grounding corpus. Sections are short and
> self-contained so retrieval cites a single clause cleanly. Synthesized from public
> AUP templates (see Sources) and aligned to this project's risk rubric.

## §1 Purpose and scope
This policy governs how employees may use AI tools — vendor-provided or internally built —
with Company data. It applies to all staff and contractors. The goal is to let people move
fast with AI while keeping regulated and confidential data protected.

## §2 Approved tools
Only tools listed in the Company's approved AI tool registry may be used with non-public
data. A tool is "approved" only after a documented review (see §6). Using an unreviewed
tool with Internal, Confidential, or Regulated data is a policy violation.

## §3 Data handling by classification
Data classification levels are defined in the Data Classification Standard. The permitted
AI use depends on the data class.

### §3.1 Public and Internal data
- **Public** data may be used with any approved AI tool.
- **Internal** data may be used only with approved tools (§2). Do not paste Internal data
  into consumer/unreviewed tools.

### §3.2 Regulated personal data (PII)
Regulated personal data — customer PII, call audio or transcripts of customer
conversations, health data, and financial data — may be used with an AI tool **only when
all of the following hold**:
1. a signed **Data Processing Agreement (DPA)** is on file with the vendor;
2. the vendor stores and processes the data in an **approved region** (for EU data subjects,
   EU data residency), with no cross-border transfer outside the required jurisdiction;
3. the vendor holds a current **SOC 2 Type II or ISO 27001** attestation;
4. data **retention is limited** (≤ 30 days) and the data is **excluded from model training**.

If any of these is missing, the use is **High risk** and must not proceed until the gap is
closed. A tool that meets 1–3 but is not yet formally approved is **Medium risk** pending
review. A tool meeting all four and formally approved is **Low risk**.

### §3.3 Confidential data
Confidential data (contracts, source code, unreleased plans) requires an approved
enterprise AI deployment with data isolation and a training-exclusion guarantee. Consumer
AI products are not permitted for Confidential data.

## §4 Third-party and vendor requirements
For any vendor AI tool processing non-public Company data:
- obtain the vendor's **DPA** and confirm **training exclusion in writing**;
- verify a current **SOC 2 Type II or ISO 27001** report;
- confirm **data residency** and **sub-processor** list;
- GDPR requires a DPA for every vendor processing EU personal data.
Internally built AI tools must meet the equivalent controls for the data class they touch.

## §5 Prohibited uses
- Submitting Regulated data to any tool that does not satisfy §3.2.
- Using AI output to make a consequential decision about a person (employment, credit,
  healthcare, legal) without documented human review.
- Allowing a third party to train models on Company data unless contractually permitted.

## §6 Onboarding and review
New AI tools are onboarded through a governance review that assesses the tool against §3–§4
for the intended data class, records a risk level and required controls, and logs the
decision in the Company's compliance system of record (Vanta). Re-review on material change.

---
Sources (public templates synthesized): Strac AI AUP template; AdeliaRisk AI AUP;
FS-ISAC "Framework of an Acceptable Use Policy for External Generative AI"; TrustCloud
data-classification guide. Adapt to your legal/compliance review before production use.
