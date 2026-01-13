# ADR 0002: Precompute NMJL pattern histograms for validation

## Status

Accepted

## Context

Validating American Mahjong hands against NMJL patterns requires checking a large number of suit permutations. Expanding permutations at runtime is expensive and complicates validation performance targets.

## Decision

Precompute all pattern variations into histograms and store them in a unified card JSON file. Validation scans a flattened lookup table of histograms and computes deficiency via fixed-length vector subtraction.

## Consequences

Validation is predictable and fast, with no runtime permutation expansion. The card data pipeline must generate and version the precomputed histograms, and card updates require regenerating the JSON data.
