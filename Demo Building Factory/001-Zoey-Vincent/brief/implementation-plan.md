# CAP-001 — Zoey Vincent Personal Brand HQ

## Priority directive

This plan is now the highest-priority execution plan for Aureum CAP V0.1. It takes precedence over unrelated pending work until CAP-001 reaches the smoke-test outcome defined below or a decision is required from the project owner.

The plan is intentionally outcome-first. It does not treat “build a website” as the goal. The goal is to research Zoey Vincent Vevakpor accurately, identify a real gap between her social distribution and owned digital destination, build a polished prospect-specific Personal Brand HQ, deploy it to a unique URL, register it in CAP, instrument the demo, complete QA, and prepare a human-approval-only outreach draft.

## What I understand from the brief

CAP-001 is the first real end-to-end prospect experiment for Aureum Technologies. Zoey is not merely a source of content for a generic template. She is the subject of a research-led product demonstration. The artifact must make it clear that Aureum studied her public brand and built a considered digital headquarters around what she already appears to do.

The proposed strategic idea is complementary rather than adversarial: social platforms distribute attention, while an owned Personal Brand HQ gives that attention a destination where people can understand Zoey’s work, inspect proof, learn from her, explore services, book or contact her, and return later. The website must not criticize LinkedIn, Instagram, TikTok, or other platforms, and it must not present Aureum as the subject. It should stand on its own as Zoey’s website.

The brief requires independent public research before implementation. The supplied positioning is starting context, not verified truth. Every factual claim must be linked to a research record with a source URL, source type, access date, confidence, and publication-safety decision. Unverified clients, testimonials, audience numbers, awards, revenue, credentials, services, results, and contact details must be excluded rather than guessed.

The intended artifact is a premium, editorial, human, conversion-focused Personal Brand HQ. It should feel personal and visually connected to Zoey’s current public identity, including any verified purple or lavender cues, photography, conversational tone, authority, and community orientation. It must not look like a corporate SaaS template, generic agency page, WordPress theme, or animation showcase.

The output is a production-quality private sales demonstration. The visible website must not contain “demo,” “concept,” “template,” “AI generated,” “website sample,” or “made by Aureum.” CAP may retain internal metadata identifying the artifact as a prospect demo. Outreach remains a draft until a human approves it. The demo itself is the pitch.

## End goal and success definition

CAP-001 is successful when the following chain is complete:

> **Research → evidence ledger → opportunity hypothesis → prospect-specific HQ → QA → deployment → CAP registration → analytics → human-reviewed outreach draft.**

The minimum end-to-end outcome is:

1. A defensible research summary exists for Zoey’s current public positioning, audience, offers, proof, voice, visual identity, and digital opportunity.
2. The website is built from verified evidence and clearly labels or omits uncertain information.
3. The website is responsive, accessible, fast, SEO-ready, visually polished, and free of fake content.
4. The site is deployed through Vercel at a unique prospect-specific URL.
5. CAP records prospect, campaign, archetype, repository, deployment, canonical URL, research, opportunity, and `DEMO_READY` status.
6. Privacy-respecting analytics record the specified demo events with `prospect_id`, `demo_id`, `campaign_id`, timestamps, and an appropriately scoped session identifier.
7. A tailored outreach draft is stored as `OUTREACH_DRAFT` with `HUMAN_APPROVAL_REQUIRED`.
8. No outreach is automatically sent.

## Priority order

| Priority | Workstream | Outcome required | Stop condition |
|---|---|---|---|
| P0 | Research and evidence | Verified research ledger and opportunity brief | No page copy or proof section is built from unsupported claims |
| P0 | Demo architecture | Prospect-specific site structure and content model | Architecture is not approved against evidence ledger |
| P0 | Build | Polished mobile-first Personal Brand HQ | Build contains placeholders, fake proof, or visible unfinished sections |
| P0 | QA and deployment | Publicly reachable, responsive, accessible, SEO-ready site | Any broken CTA, image, metadata, route, or mobile layout |
| P0 | CAP registration | CAP-001 linked to the deployed artifact | Deployment cannot be traced back to the prospect and campaign |
| P1 | Analytics | Privacy-respecting event capture and reporting | Tracking is invasive, unscoped, or missing required identifiers |
| P1 | Outreach draft | Human-approval-only message with demo URL | Any automatic send or unapproved external action |
| P2 | Expansion | Additional resources, case studies, booking integrations, or CMS | Expansion distracts from the first prospect-ready demonstration |

## Phase 0 — Freeze scope and establish the delivery record

Create a CAP-001 record with the following immutable identity fields:

- `prospect_id: CAP-001`
- `prospect_name: Zoey Vincent Vevakpor`
- `campaign_id: CAP-001`
- `archetype: PERSONAL_BRAND_HQ`
- `demo_id: zoey-vincent-personal-brand-hq`
- `slug: zoey-vincent`
- `status: RESEARCH_PENDING`

Use a dedicated project directory or repository only if the existing CAP conventions do not already support prospect-specific demo projects. Avoid creating an unnecessary repository. The selected implementation must preserve a traceable link between CAP-001, the site source, the deployment, and the research ledger.

The project record must support `prospect_id`, `demo_id`, `slug`, `deployment_id`, `canonical_url`, `deployment_status`, `created_at`, and `updated_at`.

## Phase 1 — Research before design or copy

Research the public sources listed in the brief, beginning with the primary LinkedIn profile and then following publicly linked profiles, websites, portfolio pages, booking pages, testimonials, case studies, products, and contact paths. The research process must distinguish direct evidence from inference.

Create a machine-readable research ledger with this schema:

```json
{
  "fact": "A narrowly stated factual claim",
  "source_url": "https://example.com/source",
  "source_type": "linkedin_profile | linkedin_post | instagram | website | portfolio | booking | testimonial | other",
  "accessed_at": "2026-09-17T00:00:00Z",
  "confidence": "high | medium | low",
  "safe_to_publish": true,
  "notes": "Context, limitations, or wording guidance"
}
```

Answer these questions with evidence:

1. Who does Zoey publicly say she is?
2. Who does she appear to serve?
3. Which services or products does she explicitly offer now?
4. What proof is currently verifiable?
5. What tone, vocabulary, recurring ideas, and calls to action characterize her communication?
6. What visual identity is currently observable?
7. Which social and owned channels exist?
8. What is the gap between attention generated on social platforms and an owned destination?
9. What can a Personal Brand HQ add without misrepresenting her current business?

Research outputs:

- `research/zoey-vincent-research.json`
- `research/zoey-vincent-research.md`
- `intelligence/zoey-vincent-claims.md`
- `opportunity/zoey-vincent-opportunity.md`

The claims document must have three sections: verified claims safe to publish, claims requiring cautious wording, and claims rejected because they could not be verified. A changing metric must be dated or expressed cautiously. A missing proof item must become an intentional design decision, not a fabricated statistic.

## Phase 2 — Authentic visual asset handling

Attempt to identify an authentic, publicly accessible professional image through legitimate public sources. Record the source URL, access date, usage limitation, and whether the asset is appropriate for a private sales demonstration.

Use the strongest authentic image only where retrieval and use are legitimate. Do not generate or alter Zoey’s identity. Do not use a random stock portrait. If no appropriate image can be retrieved, use a high-quality portrait placeholder structure that does not imply it is Zoey.

Create an asset inventory containing:

- Asset identifier
- Source URL
- Source type
- Local path or remote reference
- License or usage note
- Alt text
- Safe-to-use decision

Optimize all images for the web. Provide meaningful alt text. Do not make the site dependent on an unstable external image URL without a deliberate fallback.

## Phase 3 — Content and information architecture

Derive the page content from the evidence ledger. Use a long-form homepage with simple navigation, not a generic multi-page template by default.

Required sections:

1. **Hero:** authentic image or honest placeholder, name, verified positioning, concise supporting statement, primary work CTA, and secondary work-exploration CTA.
2. **Authority/proof strip:** only verified proof. If proof is insufficient, use an evidence-led statement without invented numbers.
3. **The Zoey Difference:** a concise methodology derived from public ideas without copying long passages.
4. **Services:** only publicly supported offers. Each item explains the audience, problem, intended outcome, and next action.
5. **Proof Wall:** sourced testimonials, results, brands, or public evidence. If evidence is limited, use “What I’m exploring” or “Selected signals” rather than fake case studies.
6. **Selected Work / Brands & Projects:** use case studies only when the problem, work, outcome, and source are verifiable.
7. **Content / Ideas:** short summaries or excerpts that link to originals; never republish entire posts.
8. **Social Ecosystem:** verified social links that route attention toward the HQ.
9. **About Zoey:** verified story, beliefs, work, and audience value.
10. **Resources / Learning:** only current public programs, training, mentorship, consultation, or resources.
11. **Work With Zoey:** an actual verified CTA mechanism or a clearly structured contact path.
12. **Footer:** name, positioning, verified links, contact route, legal links where appropriate, and copyright.

The content model must allow sections to be omitted when evidence is insufficient. Empty proof is better than fabricated proof.

## Phase 4 — Build the prospect-specific HQ

Use the existing project conventions where compatible. The brief recommends Next.js, TypeScript, Tailwind CSS, component architecture, Vercel, and GitHub. Do not rebuild CAP itself. Build CAP-001 as a prospect-specific experience that can later be generalized without slowing delivery.

Design requirements:

- Mobile-first and desktop-optimized layout.
- Purple/lavender direction only where research confirms it; evolve the identity rather than copying a social UI.
- Editorial hierarchy, generous whitespace, strong typography, authentic photography, and restrained accent color.
- Clear primary CTA and repeated but non-invasive conversion paths.
- Tasteful image reveals, text entrances, hover states, and transitions that do not compromise performance.
- No excessive gradients, glassmorphism, generic card grids, fake statistics, or unnecessary animation.
- No visible Aureum branding or sales banner.
- No visible demo labels or implementation notes.
- No Lorem ipsum, placeholder copy, fake numbers, fake testimonials, fake case studies, or visible TODOs.

Add a private internal metadata record identifying the site as `CAP-001`, while keeping public copy entirely about Zoey.

## Phase 5 — SEO, accessibility, and performance

Implement:

- Title and meta description derived from verified positioning.
- Canonical URL.
- Open Graph and Twitter/X metadata.
- Semantic HTML and ordered headings.
- Sitemap and robots.txt.
- Favicon and social preview.
- Image dimensions and alt text.
- Keyboard navigation and visible focus states.
- Color contrast and reduced-motion support.
- Accessible labels for every CTA and interactive component.
- Fast loading with optimized assets and no unnecessary client-side dependencies.

Use a production build and an automated link/metadata check before deployment.

## Phase 6 — Analytics without invasive tracking

Implement privacy-respecting first-party or minimal event collection. Do not use invasive fingerprinting. Event payloads should contain:

- `prospect_id: CAP-001`
- `demo_id`
- `campaign_id: CAP-001`
- Event name
- Timestamp
- A scoped session identifier only where appropriate
- Page or section context where useful

Required events:

- `demo_created`
- `demo_deployed`
- `demo_first_visit`
- `demo_visit`
- `page_view`
- `session_start`
- `session_duration`
- `scroll_depth`
- `service_click`
- `case_study_view`
- `social_click`
- `contact_click`
- `booking_click`
- `email_click`
- `whatsapp_click`
- `return_visit`

If a real analytics backend is not available, implement a clean provider abstraction and a safe development collector without pretending production analytics are active. The CAP registration must distinguish `analytics: IMPLEMENTED`, `analytics: DEPLOYED`, and `analytics: VERIFIED`.

## Phase 7 — QA and prospect-ready acceptance

Before deployment, run:

- Production build.
- Type checking.
- Lint.
- Broken-link check.
- Image existence and loading check.
- Responsive check at mobile, tablet, and desktop widths.
- Navigation and anchor check.
- CTA destination check.
- Social-link check.
- Metadata and canonical check.
- Accessibility check.
- Performance check.
- Content scan for Lorem ipsum, TODO, fake numbers, unsupported proof, and visible implementation language.

Manual review must answer:

- Does the first screen immediately feel specific to Zoey?
- Can a visitor understand who she is and what she does within seconds?
- Is every public claim supported by the research ledger?
- Is the social-to-owned-destination idea communicated without criticizing social platforms?
- Does each CTA have a real or clearly documented destination?
- Does the site look finished on a phone?
- Is Aureum absent from the public-facing experience?

Do not publish until all P0 failures are resolved.

## Phase 8 — Vercel deployment and CAP registration

Deploy through Vercel using a unique prospect-specific path. Prefer a reusable architecture that supports a future pattern such as:

- `zoey-vincent.<approved-domain>`
- `<approved-domain>/zoey-vincent`
- Another documented equivalent supported by the selected deployment setup.

Do not hard-code a one-off URL architecture that prevents future prospect demos.

Record:

- `prospect_id`
- `demo_id`
- `slug`
- `deployment_id`
- `canonical_url`
- `deployment_status`
- `repository`
- `created_at`
- `updated_at`
- `research_record`
- `opportunity_record`
- `analytics_status`
- `qa_status`

Register CAP-001 with:

```text
Prospect: Zoey Vincent Vevakpor
Campaign: CAP-001
Demo: Zoey Personal Brand HQ
Archetype: PERSONAL_BRAND_HQ
Status: DEMO_READY
Repository: [actual repository]
Vercel deployment: [actual deployment]
Demo URL: [actual URL]
Research: [research record]
Opportunity: [opportunity record]
```

The status must remain `RESEARCH_PENDING`, `BUILDING`, `QA_PENDING`, or `DEPLOYMENT_PENDING` until its evidence exists. Use `DEMO_READY` only after the deployed URL and QA evidence are recorded.

## Phase 9 — Human-approval-only outreach

Prepare, but do not send automatically, the prospect-specific outreach draft. Store it as:

```text
message_type: OUTREACH_DRAFT
approval_state: HUMAN_APPROVAL_REQUIRED
channel: SMS or the verified preferred channel
prospect_id: CAP-001
campaign_id: CAP-001
```

The draft should reference that the brand was researched and that a tailored concept was built. It should point to the actual deployed URL. It must not use generic agency language, claim that Zoey lacks a website unless verified, or imply that the artifact was requested.

Suggested structure, subject to final voice review:

> Hey Zoey, I’m back.
>
> I mentioned I was putting something together after looking through your brand, and I finally finished it.
>
> I didn’t want to explain the idea with another long message, so I built the concept first.
>
> I made this specifically around your personal brand:
>
> [DEMO URL]
>
> Have a look when you get a chance. I wanted you to see the idea before I explained it.

The final channel and recipient must be verified separately. A public phone number is not by itself evidence of permission to send an unsolicited SMS. CAP must keep the draft blocked until the project owner approves the exact channel, recipient, copy, and lawful outreach basis.

## Deliverables

The CAP-001 implementation is complete only when these artifacts exist:

- `research/zoey-vincent-research.json`
- `research/zoey-vincent-research.md`
- `intelligence/zoey-vincent-claims.md`
- `opportunity/zoey-vincent-opportunity.md`
- `assets/zoey-vincent-assets.json`
- Prospect-specific website source
- Production build output
- QA report with pass/fail evidence
- Deployment record with Vercel deployment ID and URL
- CAP registration record
- Analytics event schema and verification record
- Human-approval-only outreach draft
- CAP-001 completion report

## Definition of done for CAP-001

CAP-001 is complete when:

1. Research is independent, current, sourced, and stored.
2. Public copy contains only verified or clearly cautious claims.
3. The design is recognizably derived from Zoey’s public brand rather than a generic template.
4. The site contains no fake proof, fake metrics, fake testimonials, fake case studies, placeholders, or visible TODOs.
5. The site works responsively and passes accessibility, performance, metadata, link, image, and CTA checks.
6. The site is deployed at a unique prospect-specific URL.
7. CAP records the prospect, campaign, archetype, deployment, URL, research, opportunity, and QA state.
8. Analytics events are privacy-respecting and associated with CAP-001 metadata.
9. The outreach draft is prepared and marked `HUMAN_APPROVAL_REQUIRED`.
10. No external outreach has been sent automatically.
11. The final completion report contains the requested research, positioning, audience, services, opportunity, visual identity, assets, claims, architecture, UX decisions, repository, deployment, URL, analytics, QA results, outreach draft, blockers, and manual actions.

## Execution sequence for the next session

The next execution session should perform only the following sequence unless a critical blocker requires an owner decision:

1. Create the CAP-001 record and evidence-ledger schema.
2. Research the public sources and write the verified positioning/opportunity brief.
3. Resolve asset-use decisions and choose authentic imagery or an honest placeholder.
4. Build the prospect-specific content model and visual direction.
5. Implement the homepage and responsive interactions.
6. Add SEO, accessibility, analytics abstraction, and internal CAP metadata.
7. Run automated and manual QA.
8. Deploy to Vercel and record the unique URL.
9. Register the demo in CAP and verify its status transitions.
10. Prepare the human-approval-only outreach draft.
11. Produce the CAP-001 completion report.

The only work that should interrupt this sequence is a decision that materially changes Zoey’s verified positioning, the permitted asset usage, the deployment target, the actual CTA mechanism, or the lawful outreach channel.

## References

[1]: https://ng.linkedin.com/in/zoey-vincent-socialmediamanager "Zoey Vincent Vevakpor LinkedIn profile supplied in the CAP-001 brief"

[2]: https://www.w3.org/WAI/standards-guidelines/wcag/ "Web Content Accessibility Guidelines overview"

[3]: https://vercel.com/docs/deployments/overview "Vercel deployments overview"
