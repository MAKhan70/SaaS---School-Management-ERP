# Architectural Decision Index

| ID                                                                | Decision                                                      | Status   |
| ----------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| [ADR-0001](architecture/0001-modular-monolith.md)                 | Begin with a modular monolith                                 | Accepted |
| [ADR-0002](architecture/0002-tenant-isolation.md)                 | Trust-first tenant isolation with database defense in depth   | Accepted |
| [ADR-0003](architecture/0003-authorization.md)                    | Permission- and scope-based server authorization              | Accepted |
| [ADR-0004](architecture/0004-audit-and-history.md)                | Append-only audit and non-destructive records                 | Accepted |
| [ADR-0005](architecture/0005-background-jobs.md)                  | Typed job port and transactional outbox                       | Accepted |
| [ADR-0006](architecture/0006-core-identity-and-academic-model.md) | Separate global identity from tenant-owned people and history | Accepted |

Decisions are append-only historical records. Supersede an ADR with a new ADR rather than rewriting the rationale after implementation changes.
