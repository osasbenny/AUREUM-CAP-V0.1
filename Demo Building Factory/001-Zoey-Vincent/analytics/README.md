# CAP-001 Analytics

Analytics status: **CLIENT_EVENT_CONTRACT_IMPLEMENTED**; production analytics backend: **NOT_CONFIGURED**.

The deployed website records privacy-scoped events in `window.__CAP_EVENTS__` with `prospect_id`, `demo_id`, `campaign_id`, timestamp, and scoped session ID. The production site does not claim that a persistent analytics provider is active or verified.

The remaining analytics blocker is operational rather than a website build failure: connect an approved first-party or minimal analytics collector, then verify the required demo events in production.
