# Responsible analytics and AI-assisted capabilities

## Purpose and boundary

Analytics support authorised staff understanding of school operations. AI-assisted capabilities help staff prepare drafts; they do not replace professional judgement, policy, or statutory responsibilities. Every generated output is visibly identified as a draft and must enter an existing human-controlled workflow before it can be used.

The system must never autonomously admit or reject an applicant, impose discipline, award or deny a scholarship, promote or detain a learner, approve a waiver or refund, or make another financial decision. Student- and parent-facing interfaces do not display predictive labels such as “dropout risk” or “low performer”.

## Analytics sources and scope

`AnalyticsService` reads authoritative enrollment, admissions, attendance, examination, fee, teaching-assignment, and support-indicator records inside a verified trust transaction. School, campus, academic-year, class, section, and date filters are applied on the server. The service returns presentation-ready series, source timestamps, and a freshness classification; React charts do not calculate major metrics.

Exports contain aggregate chart rows only. Export is a separate permission from dashboard read and responses are private and non-cacheable. Each chart has a semantic data-table alternative.

## Assistance workflow

1. An authorised user chooses an approved feature and supplies minimised, non-identifying context.
2. Zod rejects context keys associated with names, contacts, identifiers, caste, religion, disability, medical information, or addresses.
3. The provider returns draft text. A policy check rejects language that attempts a prohibited autonomous decision.
4. The transaction stores provider and version, input snapshot and hash, draft, deterministic fallback, actor, timestamp, and an immutable audit event.
5. An authorised reviewer accepts, edits through the relevant source workflow, or dismisses the draft with a reason.
6. Review action, output hash, reviewer, and time are appended to the assistance audit history. No draft is published automatically.

Development uses `LocalMockAiProvider`. It makes no network request. External providers are disabled outside production even though provider inputs are already restricted. Production enablement requires a separate approved privacy, security, contractual, retention, data-location, and model-risk review.

## Non-AI fallback

Every supported feature has a deterministic template produced without a model: report-card remarks, homework questions, lesson-plan outlines, structured report-filter suggestions, and administrative summary checklists. The fallback is stored beside the generated draft and remains visible to reviewers. Analytics, exports, structured filters, and staff review indicators operate without an AI provider.

## Student support indicators

The initial indicator is a transparent attendance review rule, not a predictive model. It evaluates only recorded attendance fractions after a minimum record count. It excludes caste, religion, disability, medical information, demographic attributes, and free-text notes. The record contains a stable rule key/version, observation date, minimum input snapshot, threshold, contributing factors, plain-language limitations, and reviewer actions.

An indicator means only that authorised staff may wish to verify source data and context. It does not establish cause, forecast an outcome, or trigger an adverse action. Staff can correct factors, dismiss an irrelevant indicator, resolve a completed review, or reopen it. Student and parent portals never receive these records.

## Permissions

- `analytics.dashboard.read`: view authorised aggregate analytics.
- `analytics.data.export`: export minimum-necessary aggregate rows.
- `analytics.support.read`: view staff-only explainable indicators.
- `analytics.support.review`: run the transparent rule and review indicators.
- `ai.assistance.draft`: request an approved draft.
- `ai.assistance.review`: review draft outputs.
- `ai.audit.read`: inspect responsible-assistance evidence.

All grants are intersected with active trust, school, and campus scope. Role names never authorize behaviour.

## Privacy, retention, and monitoring

- Store the minimum aggregate or instructional context necessary for reproducibility.
- Never store secrets, raw provider tokens, hidden reasoning, or unnecessary personal information.
- Never send personally identifiable student information to a provider in development.
- Treat assistance and support records as sensitive staff data; do not expose them through analytics events or client logs.
- Retain audit and reviewer evidence according to the school’s audit schedule and archive rather than silently mutating history.
- Monitor provider-version changes, prohibited-output failures, review/dismissal rates, missing explanations, and scope denials.
- Revalidate rules for data quality and disparate impact before changing thresholds or introducing a predictive model.

## Incident and disablement procedure

Administrators can remove assistance permissions without affecting non-AI features. If a provider, prompt, rule, or data-leak concern arises, disable provider invocation, retain deterministic fallbacks, preserve audit evidence, investigate affected versions, and notify the security/privacy owner. Existing drafts remain drafts and cannot progress without human review.
