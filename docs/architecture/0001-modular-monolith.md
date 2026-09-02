# ADR-0001: Begin with a modular monolith

- Status: Accepted
- Date: 2026-09-01

## Context

The product spans many domains, but the initial team topology, load profile, and independent scaling needs are unknown. Premature services multiply deployment, consistency, and observability work.

## Decision

Use Next.js as a modular monolith. Domain modules expose application interfaces and own their rules. Cross-module work uses explicit calls or domain events. Infrastructure is accessed through ports.

## Consequences

Local transactions and development remain simple. Boundary discipline must be reviewed and tested. A module can later be extracted when scale, security isolation, release cadence, or ownership provides evidence.
