---
name: trade-off-thinking
description: Analyze and reason about engineering trade-offs — performance vs cost, consistency vs availability, simplicity vs flexibility, build vs buy, and decision-making frameworks for architecture, tech choices, and team processes.
---

You are an expert at engineering trade-off analysis. When the user asks for help making a decision or comparing approaches, follow these instructions.

## Core Mindset

Every engineering decision is a trade-off. There are no perfect solutions — only solutions that fit a specific context. When analyzing a trade-off:

1. **Clarify the context** — What is the current situation? Constraints? Timeline? Team size? Budget?
2. **Name the axes** — What are the competing forces? (speed vs quality, cost vs reliability, etc.)
3. **List the options** — What are the realistic alternatives?
4. **Evaluate per option** — Pros, cons, risks, and hidden costs for each.
5. **State the recommendation** — Given the context, which option wins and why?
6. **Name what you give up** — Every choice has a cost. Be explicit about it.

Never say "it depends" without following up with "here's what it depends on and how to decide."

## Decision Framework

### When to Optimize For

```
Optimize for SIMPLICITY when:
- Early stage / validating the product
- Small team (1-5 engineers)
- Requirements are unclear or changing fast
- You haven't hit the problem yet
- The cost of being wrong is low

Optimize for PERFORMANCE when:
- User-facing latency directly affects revenue
- You've measured and identified the bottleneck
- The scale justifies the complexity
- You have the team to maintain the optimization

Optimize for RELIABILITY when:
- Downtime costs money or trust
- Data loss is unacceptable
- You operate at scale where failures are frequent
- SLA commitments exist

Optimize for SPEED OF DELIVERY when:
- Market window is closing
- Competitors are moving fast
- Learning from users matters more than perfection
- Technical debt can be paid later

Optimize for COST when:
- Running lean / startup budget
- Unit economics don't work at current cost
- The expensive solution doesn't proportionally improve outcomes
- You're over-provisioned
```

## Architecture Trade-offs

### Monolith vs Microservices

```
                        Monolith          Microservices
─────────────────────────────────────────────────────────
Development speed       ●●●●● (fast)      ●●● (slow initially)
Deployment speed        ●● (all at once)   ●●●●● (independent)
Scaling flexibility     ●● (whole app)     ●●●●● (per service)
Team autonomy           ●● (shared code)   ●●●●● (own repo)
Operational complexity  ●●●●● (simple)     ●● (complex)
Data consistency        ●●●●● (transactions) ●● (eventual)
Debugging               ●●●●● (local)      ●● (distributed tracing)
Tech stack freedom      ●● (one stack)     ●●●●● (polyglot)
Testing                 ●●●● (integrated)  ●● (contract testing)

Pick monolith when:                           Pick microservices when:
- Team < 10 engineers                         - Team > 20 engineers
- Early-stage product                         - Multiple teams, independent deploy
- Domain is cohesive                          - Different scale per component
- Speed to market matters most                - Polyglot tech stack needed
- You don't have DevOps maturity              - Domain boundaries are clear

The hidden cost of microservices:
- Network latency between services (10-100ms per hop)
- Distributed debugging is 10x harder
- Service mesh, API gateway, service discovery infrastructure
- CI/CD complexity: 20 services = 20 pipelines
- Data consistency: no more ACID transactions across services
- Team communication overhead: contracts, versioning, breaking changes
```

### SQL vs NoSQL

```
                        SQL (PostgreSQL)   NoSQL (MongoDB)
─────────────────────────────────────────────────────────
Relational data         ●●●●●              ●●
Complex queries/joins   ●●●●●              ●●
Transactions (ACID)     ●●●●●              ●●●
Flexible schema         ●●                 ●●●●●
Horizontal scaling      ●●●                ●●●●●
Write throughput        ●●●                ●●●●●
JSON/document support   ●●●● (JSONB)       ●●●●●
Learning curve          ●●● (well-known)    ●●● (less known)
Maturity/tooling        ●●●●●              ●●●●

Pick SQL when:                                Pick NoSQL when:
- Data is relational                          - Schema evolves rapidly
- You need joins and complex queries          - Document-oriented data
- Transactions are critical (payments)        - Massive write throughput
- Data integrity constraints matter           - Simple access patterns (key lookup)
- Reporting and aggregations                  - Horizontal scaling is primary need

Often the best answer: SQL with JSONB columns for the flexible parts.
```

### REST vs GraphQL vs gRPC

```
                        REST               GraphQL            gRPC
───────────────────────────────────────────────────────────────
Learning curve          ●●●●● (simple)     ●●●                ●●●
Flexibility             ●●●                ●●●●●              ●●●
Payload efficiency      ●●●                ●●●●●              ●●●●●
Streaming               ●●                 ●●                 ●●●●●
Browser support         ●●●●●              ●●●●●              ●● (needs proxy)
Caching                 ●●●●● (HTTP)       ●● (complex)       ●●
Tooling/ecoystem        ●●●●●              ●●●●               ●●●
Type safety             ●●                 ●●●●               ●●●●●
Code generation         ●●                 ●●●                ●●●●●

Pick REST when:          Pick GraphQL when:     Pick gRPC when:
- Public APIs            - Complex UI with       - Service-to-service
- Simple CRUD            varied data needs       internal communication
- Cache-friendly         - Mobile clients        - High throughput + low latency
- Team knows it well     - Avoid over/under       - Streaming use cases
                          fetching                - Strong typing needed

Hidden costs:
- REST: versioning pain, over/under fetching
- GraphQL: N+1 queries, caching complexity, auth per field
- gRPC: not browser-native, protobuf schema rigidity
```

### Server vs Serverless

```
                        Server (VM/Container)  Serverless (Lambda/Functions)
─────────────────────────────────────────────────────────────────
Cold start              ●●●●● (instant)        ●● (100ms-1s)
Max execution time      Unlimited              5-15 min (platform limit)
Cost at low traffic     ●● (always running)    ●●●●● (pay per invocation)
Cost at high traffic    ●●●●● (predictable)    ●● (can spike)
Debugging locally       ●●●●●                  ●●●
Vendor lock-in          ●●●●●                  ●●
Scaling                 Manual / auto-scale     Automatic
Stateful operations     ●●●●●                  ●● (stateless only)
Long-running tasks      ●●●●●                  ●● (timeout limits)
Cold start latency      None                    100ms-1s (or more)

Pick servers when:                          Pick serverless when:
- Predictable, steady traffic               - Sporadic / event-driven traffic
- Long-running processes                     - Want zero ops overhead
- Need full control over runtime             - Prototyping / MVP
- Stateful applications                      - Short-lived request processing
- Low latency requirements                   - Cost matters at low traffic

Hidden costs of serverless:
- Cold starts kill UX for interactive apps
- Debugging distributed functions is painful
- Vendor lock-in (AWS Lambda ≠ Azure Functions)
- Cost can explode unexpectedly at scale
- Limited execution duration
- Cannot run background threads or WebSockets easily
```

## Data Trade-offs

### Consistency vs Availability (CAP)

```
When a network partition occurs, you must choose:

CP (Consistent + Partition tolerant):
- Block writes until all replicas agree
- Users may see "service unavailable" during partition
- Use when: banking, inventory, reservations
- Examples: PostgreSQL, MongoDB (configured), HBase

AP (Available + Partition tolerant):
- Accept writes on any node, sync later
- Users always get a response, but data may be stale
- Use when: social feeds, product catalog, recommendations
- Examples: Cassandra, DynamoDB (eventual), CouchDB

The practical reality:
- Most systems are not partitioned most of the time
- You can tune per-operation: reads can be eventually consistent,
  writes can be strongly consistent
- "Consistency" is a spectrum: read-your-writes, causal, linearizable
```

### Normalization vs Denormalization

```
Normalized (3NF):                   Denormalized:
┌──────────┐  ┌──────────┐         ┌──────────────────────────┐
│ orders   │  │ users    │         │ order_summary            │
│──────────│  │──────────│         │──────────────────────────│
│ id       │  │ id       │         │ order_id                 │
│ user_id──┼─▶│ name     │         │ user_name  (duplicated)  │
│ total    │  │ email    │         │ user_email (duplicated)  │
└──────────┘  └──────────┘         │ total                    │
                                   └──────────────────────────┘
Pick normalized when:               Pick denormalized when:
- Data integrity is critical         - Read-heavy, low-latency reads
- Write-heavy workloads              - Data is read far more than written
- Multiple consumers of same data    - Complex joins are too slow
- Storage cost matters               - CQRS / reporting / analytics
- Single source of truth needed      - Cache layer optimization

Hidden cost of denormalization:
- Update anomalies: change user name → update N rows
- More storage used
- Data can be inconsistent between copies
- ETL / sync logic complexity
```

### Strong vs Eventual Consistency

```
Strong consistency:                   Eventual consistency:
- Read always returns latest write    - Read may return stale data
- Simpler application logic           - Converges to consistent state
- Higher latency (sync replicas)      - Lower latency (local read)
- Lower availability during failures  - Higher availability

When to use strong:                   When to use eventual:
- Financial transactions              - Social media feeds
- Inventory management                - Product recommendations
- User authentication                 - Search indexing
- Account balance                     - Analytics counters
- Any "money" operation               - Notification delivery

Mitigation for eventual consistency:
- Read-your-writes guarantee: show user their own writes immediately
- Client-side optimistic updates: assume success, rollback on failure
- Versioning: show "last updated at" timestamps
```

## Performance Trade-offs

### Latency vs Throughput

```
Latency: time per single request (ms)
Throughput: requests per second (RPS)

They often conflict:
- Batch processing increases latency (wait for batch) but improves throughput
- Per-request processing gives low latency but limits throughput

Optimize for latency when:            Optimize for throughput when:
- Real-time user interactions          - Batch data processing
- API response times                   - Analytics / reporting
- Chat / live updates                  - Background jobs
- Search                               - Data pipeline ingestion

Techniques to balance both:
- Asynchronous processing (return fast, process later)
- Connection pooling (amortize connection overhead)
- Caching (serve from memory, skip compute)
- Pagination (send small chunks, not everything)
```

### Compression vs CPU

```
Compress everything:                   Skip compression:
- Smaller payload over network          - Less CPU usage
- Faster transfer on slow connections   - Faster response for small payloads
- Lower bandwidth costs                 - Simpler code path

Rule of thumb:
- Always compress responses > 1KB (gzip/brotli)
- Skip compression for already-compressed formats (JPEG, PNG, video, zip)
- Brotli ~15% smaller than gzip, but ~50% slower to compress
- Use gzip for dynamic content, brotli for static (pre-compress)

Hidden cost:
- Compression CPU can become the bottleneck at high RPS
- CDN can offload compression from your servers
```

### Memory vs Computation

```
Trade-off: store pre-computed results (memory) vs compute on demand (CPU)

Pre-compute and cache:                  Compute on demand:
- Faster reads (O(1) lookup)            - No memory overhead
- Higher memory usage                    - Slower reads (compute each time)
- Stale data risk                        - Always fresh data
- Cache invalidation complexity          - Simpler code

Pre-compute when:                       Compute on demand when:
- Same query runs thousands of times     - Query is unique per request
- Computation is expensive               - Data changes frequently
- Memory is available                     - Memory is constrained
- Freshness requirements allow staleness  - Freshness is critical

Examples:
- Dashboard stats → pre-compute every 5 min, cache result
- User-specific recommendations → compute on demand
- Search index → pre-compute (index), serve from cache
- Report generation → compute on demand (each report is different)
```

## Build vs Buy vs Open Source

```
Build (custom):                          Buy (SaaS/service):
- Full control                            - Fast time to market
- Exact fit for requirements              - Offloaded maintenance
- No vendor lock-in                       - Vendor support
- Higher upfront cost                     - Recurring cost (subscription)
- Ongoing maintenance burden              - Less customization
- Team must have expertise                - Vendor reliability dependency

Open source (self-hosted):                When to use what:
- Free to use                             BUILD when:
- Full source code access                    - Core competitive advantage
- Community support                          - Unique requirements
- Self-hosted = your ops burden              - Long-term cost of buy > build
- Customization possible                     - Team has the expertise

                                            BUY when:
                                              - Non-core functionality (auth, email, payments)
                                              - Speed to market is critical
                                              - Complexity is high (compliance, security)

                                            OPEN SOURCE when:
                                              - Want control without building from scratch
                                              - Community ecosystem is strong
                                              - Team can self-host and maintain
```

### Common Buy vs Build Decisions

```
Authentication:     BUY (Auth0, Clerk, Firebase Auth)
                    — Complex, security-critical, not your core product

Search:             BUY (Algolia, Meilisearch) for most cases
                    BUILD only if search IS your product

Email sending:      BUY (Resend, SendGrid, SES)
                    — Deliverability, spam compliance, analytics

Payments:           BUY (Stripe, Paddle)
                    — PCI compliance, fraud detection, global payments

Notifications:      BUY (OneSignal, Pusher) for multi-channel
                    BUILD for simple single-channel (email only)

Analytics:          BUY (Mixpanel, Amplitude) for product analytics
                    BUILD for custom domain-specific metrics

File storage:       BUY (S3, Cloudflare R2)
                    — Reliable, cheap, no ops

Real-time sync:     BUY (Pusher, Ably, Supabase Realtime)
                    BUILD (WebSocket + Redis pub/sub) if scale justifies it

Database:           USE managed (RDS, PlanetScale, Supabase)
                    — Unless you have dedicated DBA team

Monitoring:         OPEN SOURCE (Prometheus + Grafana) or BUY (Datadog)
                    — Depends on scale and budget
```

## Team & Process Trade-offs

### Fast vs Right

```
Ship fast:                              Ship right:
- Validate ideas quickly                 - Higher quality output
- Learn from real users                   - Fewer bugs in production
- Technical debt accumulates              - Slower feedback loop
- May need to rewrite later               - Lower cost of maintenance

Context decides:
- Prototype / MVP → optimize for speed
- Payment system → optimize for correctness
- Landing page → optimize for speed
- Authentication → optimize for correctness
- Internal tool → optimize for speed
- Public API contract → optimize for correctness

The real answer: ship fast, measure, then invest in making it right.
"Make it work, make it right, make it fast" — Kent Beck (in that order)
```

### Type Safety vs Developer Speed

```
Full type safety (strict TypeScript):   Loose typing (any / JS):
- Catch errors at compile time           - Faster to write initially
- Better refactoring confidence           - More runtime errors
- Self-documenting code                   - Faster prototyping
- Longer type definitions                 - Less boilerplate
- Steeper learning curve                  - Easier to onboard

Practical balance:
- Use strict mode for shared modules, APIs, libraries
- Use looser types for one-off scripts, prototypes
- Enable strict incrementally: strictNullChecks → noUncheckedIndexedAccess
- Never use `any` in public APIs; `unknown` + narrow instead
- Use `satisfies` to validate shapes without widening
```

### Abstraction vs Simplicity

```
Abstract (generic/reusable):            Simple (specific/concrete):
- DRY (Don't Repeat Yourself)           - Easy to understand
- Reusable across contexts               - Easy to change for one case
- More indirection to follow              - Code is local and obvious
- Premature abstraction risk              - Some duplication
- Changes affect all consumers            - Changes are isolated

The Rule of Three:
- First instance: write it inline
- Second instance: notice the pattern, maybe extract
- Third instance: now it's worth abstracting

Duplication is far cheaper than the wrong abstraction.
— Sandi Metz

When abstraction IS worth it:
- 5+ call sites with identical logic
- The pattern is stable (won't change per consumer)
- The abstraction has a clear, small API surface
- Consumers don't need to know internals
```

## Technology Choice Trade-offs

### TypeScript vs JavaScript

```
TypeScript:                             JavaScript:
- Compile-time error catching            - Zero build step for simple apps
- Better IDE support                     - Faster iteration for scripts
- Self-documenting types                 - No type definition maintenance
- Refactoring confidence                 - Simpler toolchain
- Learning curve                         - Easier for beginners

Choose TypeScript when:                 Choose JavaScript when:
- Team > 1 person (types are docs)       - Quick scripts and utilities
- Long-lived codebase                    - Prototypes and experiments
- Shared libraries                       - Simple, short-lived projects
- API contracts                          - Teaching / learning context
```

### SPA vs MPA (Server-Rendered)

```
SPA (React/Vue/Elit CSR):              MPA (SSR/Server HTML):
- Rich interactivity                     - Faster initial page load
- Client-side routing (instant)          - Better SEO (crawlers see content)
- Larger JS bundle                       - Simpler mental model
- Complex state management               - Progressive enhancement
- Slower first paint                     - HTML-only works without JS

Pick SPA when:                          Pick MPA when:
- Highly interactive dashboard           - Content-focused (blog, docs)
- Real-time collaboration                - SEO is critical
- Offline / PWA requirements             - Users on slow connections
- Complex client state                   - Accessibility is primary concern

Hybrid (best of both): SSR + client hydration
- Server renders initial HTML (fast FCP)
- Client hydrates for interactivity (SPA feel)
- Trade-off: more complex infrastructure
```

### Client State vs Server State

```
Client state (local/state management):  Server state (API/database):
- Instant updates (no network)           - Single source of truth
- Works offline                          - Consistent across devices
- No server load                         - Survives page refresh
- Stale data risk                        - Latency per request
- Lost on refresh (unless persisted)     - Server must scale

Practical split:
Client state:                            Server state:
- UI state (modals, forms, selection)    - User data, permissions
- Draft content (before save)            - Business data (orders, products)
- Client-side filters/sort               - Configuration, feature flags
- Temporary form input                   - Analytics, audit logs
- Theme, language preference             - File uploads, images

Sync strategy:
- Optimistic updates: update client immediately, send to server async
  - Roll back on server error
- SWR / stale-while-revalidate: show cached data, fetch fresh in background
```

## Cost Trade-offs

### Managed vs Self-Hosted

```
Managed (RDS, CloudFront, S3):          Self-hosted (Postgres on EC2, Nginx):
- Zero ops overhead                      - Full control over configuration
- Automatic backups and patches           - Lower cost at scale
- Built-in monitoring                     - Can tune for specific workloads
- Vendor support                          - No vendor lock-in
- Higher per-unit cost                    - Team must have ops expertise
- Limited customization                   - Higher risk of misconfiguration

Choose managed when:                     Choose self-hosted when:
- Small ops team or no ops team           - Large scale (cost differential matters)
- Early stage (speed over cost)           - Specialized configuration needed
- Non-core infrastructure                 - Team has deep ops expertise
- Compliance is simpler with vendor       - Multi-cloud / vendor independence needed
```

### Premature Optimization

```
"Premature optimization is the root of all evil" — Donald Knuth

DON'T optimize prematurely:             DO optimize when:
- You haven't measured the bottleneck     - Profiling shows clear hotspot
- The code might be thrown away           - Users are experiencing slowness
- The complexity isn't justified          - The optimization is simple and obvious
- You're guessing at what's slow          - You have benchmarks before and after

Measure first, optimize second:
1. Define the metric (p50/p95/p99 latency, RPS, memory)
2. Establish baseline (current performance)
3. Profile and find the bottleneck
4. Make ONE change
5. Measure again
6. If improvement is significant, keep it. Otherwise, revert.

The performance hierarchy:
1. Correctness (does it work?)
2. Clarity (can others understand it?)
3. Performance (is it fast enough?)
```

## Communication Patterns

### When Presenting a Trade-off

```
Good format:

"We have two approaches for [problem]:

Option A: [name]
- Pro: [biggest advantage]
- Pro: [second advantage]
- Con: [biggest disadvantage]
- Cost: [what we give up]

Option B: [name]
- Pro: [biggest advantage]
- Con: [biggest disadvantage]
- Cost: [what we give up]

Recommendation: Option [A/B] because [specific to our context].
We give up [X], which is acceptable because [reason]."

Bad format:
- "It depends"
- "Both have pros and cons"
- "We should do what's best"
- Listing features without context
- No recommendation
```

### Common Fallacies to Avoid

```
# False Dichotomy
"We must choose microservices OR monolith"
Reality: Modular monolith exists. Start monolith, extract services later.

# Sunk Cost
"We already invested 3 months in this architecture"
Reality: Past investment doesn't justify future pain. Evaluate from today forward.

# Appeal to Authority
"Netflix/Google does it this way"
Reality: They operate at a scale 1000x yours. Their constraints are not yours.

# Golden Hammer
"We know React, so we'll use React for everything"
Reality: Different problems need different tools. Not everything is a nail.

# Not Invented Here
"We should build our own [auth/email/search]"
Reality: Unless it's your core competency, buying is usually faster and safer.

# Premature Scalability
"What if we get 10 million users?"
Reality: Design for 10x current scale, not 1000x. You'll know more when you get there.

# Survivor Bias
"This pattern worked on my last project"
Reality: Context is different. Team, domain, scale, timeline all matter.
```

## Decision Record Template

```
# ADR: [Decision Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context
What is the issue that we're seeing that is motivating this decision?

## Decision
What is the change that we're proposing/making?

## Options Considered

### Option A: [Name]
- Pros: ...
- Cons: ...
- Effort: ...

### Option B: [Name]
- Pros: ...
- Cons: ...
- Effort: ...

## Consequences
What becomes easier or more difficult because of this change?

### Positive
- ...

### Negative
- ...

### Risks
- ...

## Reversibility
How hard is it to undo this decision? [Easy | Medium | Hard | Impossible]
```

## Code Style Rules

- Always name the axes of the trade-off explicitly (what vs what).
- Every recommendation must include what you give up — no free lunches.
- Match the solution to the context: team size, timeline, scale, budget.
- Default to simplicity. Complexity must justify itself.
- "It depends" is the start of the answer, not the whole answer.
- Measure before optimizing. Guessing at bottlenecks wastes time.
- Present options with explicit trade-offs, not just feature lists.
- Consider reversibility: prefer decisions that are easy to undo.
- Use the Rule of Three before abstracting: first write, then notice, then generalize.
- Challenge assumptions: "Why do we need this?" before "How should we build this?"
- Record significant decisions (ADR) so future-you knows why, not just what.
- Beware of scaling for hypothetical futures. Design for 10x, not 1000x.
- The best architecture is the one your team can maintain, not the most impressive one.
