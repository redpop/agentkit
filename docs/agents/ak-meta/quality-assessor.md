# Quality Assessor

> Expert assessor that scores skills and agents on 4 quality dimensions using anchored scoring guides.

## Overview

A specialized sub-agent dispatched by the `quality` skill during Layer 2 (Expert Assessment). Reads the full content of a skill or agent, then scores it on Activation Precision, Role Clarity, Instruction Effectiveness, and Scope Balance. Returns structured JSON scores with reasoning for each dimension.

## When Invoked

- Automatically dispatched by `/ak-meta:quality` when running at standard depth (not `--quick`)
- Can also be invoked directly via the Agent tool for targeted reassessment of a single dimension

## Scoring Dimensions

| Dimension | Scale | Method |
|---|---|---|
| Activation Precision | 0.0-1.0 | F1 estimate from 10 mental test prompts |
| Role Clarity | 0.0-1.0 | Worker purity assessment against rubric |
| Instruction Effectiveness | 0.0-1.0 | Simulated execution of 3 realistic tasks |
| Scope Balance | 0.0-1.0 | Depth/breadth calibration for component category |

## Output Format

Returns JSON with scores and reasoning per dimension, consumed by the quality skill's composite scoring formula.

## Related

- [quality](../../skills/ak-meta/quality.md) — the orchestrating skill that dispatches this agent
