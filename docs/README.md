# Documentation Guide

This directory contains all technical documentation for the American Mahjong project.

## Directory Structure

### `architecture/`

**Active reference documentation** for system design, patterns, and architectural decisions.

**Use this when:**

- Understanding how the system is designed
- Making architectural decisions
- Onboarding new developers
- Reviewing system contracts and interfaces

**Index**: [docs/architecture/00-ARCHITECTURE.md](architecture/00-ARCHITECTURE.md)

### `implementation/`

**Current implementation specifications** for active work and reference.

**Use this when:**

- Implementing new features
- Understanding implementation details
- Writing tests
- Reviewing code

**Index**: [docs/implementation/00-IMPLEMENTATION.md](implementation/00-IMPLEMENTATION.md)

### `archive/`

**Completed work artifacts** including implementation plans and summaries.

**Use this when:**

- Understanding why decisions were made
- Reviewing historical context
- Onboarding new team members
- Debugging implementation-related issues

**Contents:**

- `plans/` - Implementation plans that have been executed
- `summaries/` - Post-implementation completion reports

**Index**: [docs/archive/README.md](archive/README.md)

### `deprecated/`

**Obsolete documentation** that has been superseded or is no longer accurate.

**Use this when:**

- You need to understand old approaches
- Researching design evolution
- Referenced by git history

**Index**: [docs/deprecated/README.md](deprecated/README.md)

## Quick Navigation

### I want to understand

- **How the game works**: Start with [architecture/01-system-overview.md](architecture/01-system-overview.md)
- **The command/event system**: See [architecture/06-command-event-system-api-contract.md](architecture/06-command-event-system-api-contract.md)
- **The data format**: See [architecture/07-the-card-schema.md](architecture/07-the-card-schema.md)
- **The state machine**: See [architecture/04-state-machine-design.md](architecture/04-state-machine-design.md)
- **Frontend architecture**: See [architecture/frontend/10-frontend-architecture.md](architecture/frontend/10-frontend-architecture.md)

### I want to implement

- **A new feature**: Check [implementation/00-IMPLEMENTATION.md](implementation/00-IMPLEMENTATION.md) for specs
- **Tests**: See [implementation/12-testing-strategy.md](implementation/12-testing-strategy.md)
- **Deployment**: See [implementation/09-deployment.md](implementation/09-deployment.md)

### I want to know what's been completed

- **Recent implementations**: Check [archive/summaries/](archive/summaries/)
- **Original implementation plans**: Check [archive/plans/](archive/plans/)

## Documentation Standards

### Source of Truth

- Prefer rustdoc and code comments as the canonical implementation reference.
- Use ADRs to capture decisions that are not obvious from code.
- Use markdown docs for onboarding, workflows, and non-code context only when needed.

### Active Documents

- Must be current and accurate
- Should link to related docs
- Should have a clear purpose and audience
- Must be kept up-to-date with code changes

### Archiving Policy

Move documents to `archive/` when:

- Implementation is complete and stable (summaries)
- Plan has been executed (plans)
- Document is no longer actively referenced

### Deprecation Policy

Move documents to `deprecated/` when:

- Document has been superseded by a newer version
- Approach described was replaced or abandoned
- Information is outdated or incorrect

**Always add a deprecation notice** with:

- Date deprecated
- Reason for deprecation
- Link to replacement (if applicable)

## Document Types

### Architecture Documents

- System design and patterns
- Interface contracts
- Data models and schemas
- Technology decisions

**Lifecycle**: Long-lived, updated as architecture evolves

### Implementation Documents

- Feature specifications
- Implementation guides
- Technical details
- Integration instructions

**Lifecycle**: Active during implementation, archived when stable

### Plans

- Pre-implementation blueprints
- Approach and scope
- Decision points

**Lifecycle**: Active until implementation complete, then archived

### Summaries

- Post-implementation reports
- What was built and how
- Lessons learned
- Known limitations

**Lifecycle**: Active for 1-2 weeks post-implementation, then archived

---

**Last Updated**: 2026-01-09
