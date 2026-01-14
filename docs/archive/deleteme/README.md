# Deprecated Documentation

This directory contains documentation that is **obsolete, superseded, or no longer accurate**.

## Why Keep Deprecated Docs?

Rather than deleting outdated documentation, we preserve it here for:

- Historical reference
- Understanding evolution of design decisions
- Avoiding repeated mistakes
- Git history preservation (easier to find with `git log`)

## When to Move Files Here

Move documentation to `deprecated/` when:

- A newer version of the document exists
- The approach described was replaced by a different solution
- The feature/component was removed from the codebase
- The document contains outdated or incorrect information

## Files Should Be Marked

Each deprecated file should have a header indicating:

- **Why it's deprecated** (e.g., "Superseded by X", "Feature removed", "Approach abandoned")
- **Date deprecated**
- **Replacement document** (if applicable)

## Do Not Move Here

- Completed work (use `docs/archive/` instead)
- Draft documents (keep in working directory or delete)
- Temporary notes (should be deleted, not archived)

---

**Last Updated**: 2026-01-09
