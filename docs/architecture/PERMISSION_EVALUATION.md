# Permission Evaluation Design

## Catalogue

Permissions are platform-owned and use stable lowercase keys such as `students.profile.read`. Keys are contracts for server policies, tests, audit events, and integrations; display labels are translated separately.

Roles are bundles:

- System roles are global templates and have no `trust_id`.
- Tenant roles belong to one trust and cannot grant permissions unavailable to the assigning administrator.
- A role name never authorizes behavior.

## Resolution

For an authenticated request, the server resolves:

1. Active, unrevoked user and session.
2. Verified active trust and school/campus memberships.
3. Active role assignments effective at the current time.
4. Active role and role-permission rows.
5. Resource tenant and institutional scope.
6. Contextual policy such as self, linked child, teaching assignment, academic-period state, or dual approval.

The pure evaluator returns an allow/deny decision and safe reason code. It denies by default for trust mismatch, absent/expired assignment, missing permission, or out-of-scope resource.

## Scope semantics

| Scope           | Requirement                                                          |
| --------------- | -------------------------------------------------------------------- |
| Trust           | Resource belongs to active trust                                     |
| School          | Resource school equals assignment school                             |
| Campus          | Resource school and campus equal assignment scope                    |
| Self            | Resource owner is the actor                                          |
| Linked children | Resource person is linked through an effective guardian relationship |

Business-specific constraints are evaluated after the base scope—for example, a teacher may still need a current teaching assignment for a section.

## Caching and revocation

Resolved grants may be cached only with user, trust, membership-version, and permission-catalogue version in the key. Role/membership changes increment a version or evict cached grants and trigger session re-evaluation. High-risk changes may revoke sessions immediately.

## Audit

Role creation, permission-bundle changes, assignments, revocations, break-glass access, and sensitive denials create audit events. Logs contain stable keys and safe reason codes, not personal record contents.
