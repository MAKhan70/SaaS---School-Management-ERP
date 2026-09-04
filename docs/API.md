# HTTP API

## Conventions

Internal authenticated APIs use `/api/v1`. Infrastructure and authentication endpoints are outside that prefix. Cookie authentication uses the opaque `nasaq_session` cookie; scripts must not read it. Mutations require an exact trusted Origin and JSON or URL-encoded content with bounded body size. Responses containing tenant or personal data use `Cache-Control: no-store` or private/no-store. Dates use ISO 8601; persisted instants are UTC; money is integer minor units plus ISO currency.

Errors use an appropriate HTTP status and generic `{ "error": "..." }` body. Do not infer object existence from 403/404. Correlation IDs are accepted/generated for internal diagnostics but must not contain personal data.

## Infrastructure

| Method/path       | Authentication | Purpose                                                             |
| ----------------- | -------------- | ------------------------------------------------------------------- |
| `GET /api/health` | None           | Process liveness; static service/version body; no dependency checks |
| `GET /api/ready`  | None           | PostgreSQL readiness; 200 ready or generic 503                      |

## Authentication and onboarding

| Method/path                         | Control summary                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-in`            | Origin, body/schema, persistent identity/IP throttling, account lockout, generic failures, secure session cookie, audit               |
| `POST /api/auth/sign-out`           | Origin, session revocation, cookie expiry, Clear-Site-Data                                                                            |
| `POST /api/auth/password/forgot`    | Origin, generic accepted response, throttling, single-use delivery adapter                                                            |
| `POST /api/auth/password/reset`     | Origin, token/password schema, token consumption, all-session revocation                                                              |
| `POST /api/auth/context`            | Origin, active session, effective trust/school/campus/year access, audit                                                              |
| `POST /api/auth/sessions/revoke`    | Origin, active session, ownership-bound target ID                                                                                     |
| `POST /api/onboarding`              | Origin, schema, persistent IP/email throttling, one transaction and audit; public enablement should be invitation-gated in production |
| `POST /api/auth/invitations/accept` | Origin, trust routing ID, hashed single-use token, password policy, session revocation, and audit                                     |

Public `/api/onboarding` remains available in local development for compatibility and is disabled by default in production. `ALLOW_PUBLIC_ONBOARDING=true` is intended only for an explicitly approved isolated environment.

## NASAQ platform control plane

| Method/path                                | Permission                | Purpose                                                                          |
| ------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/platform/clients`                | `platform.clients.manage` | List client organizations and enabled features                                   |
| `POST /api/platform/clients`               | `platform.clients.manage` | Transactionally provision a client and request administrator invitation delivery |
| `POST /api/platform/clients/{id}/features` | `platform.clients.manage` | Replace enabled feature entitlements and audit the change                        |
| `POST /api/platform/clients/{id}/support`  | `platform.support.access` | Start reasoned, maximum 60-minute support access and switch the session context  |

## Public admissions

| Method/path                               | Purpose                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/public/admissions/{publicKey}`  | Published form metadata and signed short-lived form token; no applicant data                               |
| `POST /api/public/admissions/{publicKey}` | Honeypot, form token, contact/IP/form throttling, configurable field validation, tenant-scoped transaction |

## Authenticated resources

Every endpoint authenticates and its application service enforces stable permissions plus active trust/school/campus/year and resource scope.

| Path                                    | Methods / capability                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/api/v1/institutions/schools`          | Read authorized school/campus context                                                      |
| `/api/v1/institutions`                  | GET scoped organisation profiles; POST validated, audited profile update                   |
| `/api/v1/school-setup`                  | GET setup model; POST validated configuration mutation                                     |
| `/api/v1/school-setup/templates/{kind}` | Authorized CSV template download                                                           |
| `/api/v1/students`                      | GET filtered paginated directory; POST mutation                                            |
| `/api/v1/students/{id}`                 | Scoped profile read                                                                        |
| `/api/v1/students/import`               | POST CSV preview or bounded JSON commit; import permission and audit                       |
| `/api/v1/students/export`               | Authorized audited bounded CSV export with spreadsheet-formula neutralization              |
| `/api/v1/students/documents/{id}`       | Authorized scoped download request; returns 501 until private storage adapter exists       |
| `/api/v1/admissions`                    | GET CRM dashboard; POST workflow mutation                                                  |
| `/api/v1/admissions/{id}`               | Scoped application detail                                                                  |
| `/api/v1/admissions/documents/{id}`     | Authorized scoped request; returns 501 until storage exists                                |
| `/api/v1/attendance`                    | GET workspace/report model; POST attendance/approval mutation                              |
| `/api/v1/examinations`                  | GET workspace; POST gradebook/publication/report mutation                                  |
| `/api/v1/fees`                          | GET ledger/report model; POST financial workflow mutation with idempotency/ledger controls |
| `/api/v1/operations/{module}`           | GET module workspace; POST scoped operational-record mutation                              |
| `/api/v1/analytics`                     | GET permission-aware model or separately authorized/audited CSV export                     |
| `/api/v1/ai-assistance`                 | GET staff workspace; POST draft/review/indicator action; local non-PII provider policy     |

## Versioning and limits

Breaking public contract changes require a new API version or a documented compatibility window. Current interactive lists are deliberately bounded; admissions and operations return at most 100 rows, student directory is page-based, and student CSV export currently includes at most 100 rows. Large exports require a future asynchronous, expiring private-file workflow.

No OpenAPI document is generated yet. Shared Zod contracts are authoritative for implemented inputs; generating and validating OpenAPI against them is a recommended next task.
