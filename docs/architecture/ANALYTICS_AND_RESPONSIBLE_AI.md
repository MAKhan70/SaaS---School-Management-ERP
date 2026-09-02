# Analytics and responsible-assistance architecture

## Service boundaries

`AnalyticsService` is a read-only application service over authoritative module records. It validates filters, verifies school and campus membership, requires `analytics.dashboard.read`, establishes transaction-local trust RLS, and returns chart series plus source freshness. Aggregate CSV export reuses the same view model and independently requires `analytics.data.export`.

`AiAssistanceService` owns draft creation, human review, transparent support-rule refresh, indicator correction/dismissal, and immutable evidence. It never publishes a report card, homework item, lesson plan, report filter, summary, or student action. Source modules remain responsible for their final content and decisions.

## Provider port

`AiDraftProvider` accepts only a feature key and a flat, validated non-identifying context. `LocalMockAiProvider` is the default and only development provider. Each feature also has a deterministic fallback independent of the provider. External implementations must not be registered before a separate production approval and data-flow review.

## Tenant and permission controls

All assistance and indicator rows store `trustId` and school scope; campus and academic year refine access. APIs resolve scope from the authenticated server context and use PostgreSQL RLS. Dashboard, export, indicator read/review, draft creation/review, and audit read are separate permissions.

## Audit and reproducibility

Draft records store provider/model version, safe input snapshot and SHA-256 hash, generated output, fallback output, actor, and date. Append-only events store input/output hashes and reviewer action. Indicators store rule version, observation date, minimum numerical inputs, contributing factors, reason, and review state; append-only events preserve corrections and dispositions. Ordinary audit events are written in the same transaction as mutations.

## Presentation

Charts are display-only client components over server-calculated series. Every chart includes a caption and semantic table alternative. Fresh, stale, and unavailable states are textual rather than colour-only. Student-support indicators appear only in authorised staff interfaces and use masked student references.

See [Responsible analytics and AI-assisted capabilities](../RESPONSIBLE_AI.md) for operational restrictions, privacy, retention, monitoring, and incident handling.
