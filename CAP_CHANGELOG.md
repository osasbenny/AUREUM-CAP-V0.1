# CAP V0.1 — Change Log

Permanent project change and execution ledger. Entries are append-only in normal use.

## 2026-09-19 — ALB HTTPS listener created

**What changed?** The AWS Application Load Balancer `aureum-cap-v01-api` received an HTTPS listener on port 443 using the issued ACM certificate for `api.cactusdigitalmedia.ng`, forwarding to the `aureum-cap-v01-api-tg` target group.

**Why?** HTTPS is required before the Vercel Command Center can safely connect to the production API.

**Previous state:** The ALB was active but had zero listeners; the API hostname could not serve HTTPS traffic.

**New state:** The ALB is active with the HTTPS listener successfully created. Public DNS for `api.cactusdigitalmedia.ng` resolves to the ALB hostname `aureum-cap-v01-api-713211093.eu-north-1.elb.amazonaws.com`.

**Affected services:** AWS ACM, AWS Application Load Balancer, cPanel DNS.

**Verification:** `https://api.cactusdigitalmedia.ng/health` reaches the ALB and returns HTTP 503 from `awselb/2.0`. This confirms the HTTPS route is live; 503 remains because the ECS target group has no healthy API task yet.

**Committed and pushed?** Not yet. This entry is being recorded before the ECS deployment step, as required by the project reporting rule.

**Remaining incomplete or blocked:** ECS API deployment, target health, production admin secret, Vercel `VITE_API_BASE_URL`, and end-to-end login verification. `CAP_SEND_ENABLED=false` and `CAP_SMS_SEND_ENABLED=false` remain unchanged.

**Architecture impact:** None. The approved AWS ECS/Fargate + private RDS + ALB architecture remains unchanged.
