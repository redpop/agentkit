# LLM Security Guidelines

> Security rules for LLM applications based on the OWASP Top 10 for LLM Applications 2025.

## Overview

Covers all ten OWASP LLM risk categories: prompt injection, sensitive information disclosure, supply chain vulnerabilities, data poisoning, improper output handling, excessive agency, system prompt leakage, vector/embedding weaknesses, misinformation, and unbounded consumption. Includes a "What Are You Building?" mapping to quickly identify which rules matter for chatbots, RAG systems, AI agents, fine-tuning pipelines, and LLM-powered APIs.

## Usage

```text
/ak-security:llm-security
```

Activates automatically when building or reviewing code that interacts with LLMs -- prompt handling, output processing, tool use, or data pipelines.

## When to Use

- Building chatbots, RAG systems, or AI agents with tool access
- Implementing prompt handling or LLM output processing
- Fine-tuning models or managing training data pipelines
- Reviewing LLM application code for security risks
- Designing rate limiting or resource controls for LLM APIs

## Best Practices

- Never trust LLM output -- validate and sanitize before any downstream use
- Apply least privilege to all LLM system permissions and tool access
- Layer multiple security controls (defense in depth)
- Require human approval for high-impact actions in agentic systems
- Protect system prompts from disclosure; never store secrets in prompts

## Related

- [code-security](./code-security.md) -- general code security rules (complementary)
- [semgrep](./semgrep.md) -- automated scanning for vulnerability patterns
- [OWASP Top 10 for LLM Applications 2025](https://genai.owasp.org/llm-top-10/)
