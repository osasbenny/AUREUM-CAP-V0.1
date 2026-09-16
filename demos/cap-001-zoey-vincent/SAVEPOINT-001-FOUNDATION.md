# CAP-001 Savepoint 001 — Foundation

**Status:** `RESEARCH_PENDING`  
**Date:** 17 September 2026  
**Project:** Zoey Vincent Personal Brand HQ  
**Prospect:** Zoey Vincent Vevakpor  
**Campaign:** CAP-001  
**Archetype:** `PERSONAL_BRAND_HQ`

## Decision

Zoey’s Brand HQ will be implemented as a dedicated project folder at:

```text
demos/cap-001-zoey-vincent/
```

It will remain inside the existing Aureum CAP V0.1 GitHub repository rather than creating a new repository. This preserves a single auditable source of truth for prospect records, research, deployment metadata, outreach drafts, and future demo projects while allowing the folder to have its own deployable application boundary.

Vercel can deploy this folder as an independent project using the folder as the project root. The final deployment URL and deployment ID will be recorded in CAP-001 metadata after deployment.

## Created structure

```text
demos/cap-001-zoey-vincent/
├── public/
├── research/
├── src/
└── SAVEPOINT-001-FOUNDATION.md
```

## Scope guardrails

The project will not begin with website copy or unsupported claims. Public research comes first. Every factual claim must receive a source URL, source type, access date, confidence rating, and publication-safety decision.

The website will be Zoey’s artifact. Aureum branding, visible demo labels, generic agency language, fake proof, invented metrics, fabricated testimonials, and automatic outreach are excluded.

## Next savepoint

The next savepoint will contain the public-source research ledger, verified positioning, audience, supported services, proof inventory, voice findings, visual identity findings, and the owned-destination opportunity hypothesis.
