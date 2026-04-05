# Diagram Creator

> Creates Mermaid diagrams for architecture visualization, process flows, data models, and system interactions.

## Overview

A specialized agent that generates professional Mermaid diagrams from code analysis or descriptions. Supports all Mermaid diagram types: flowcharts, sequence diagrams, class diagrams, ERDs, state diagrams, Gantt charts, git graphs, journey maps, and C4 architecture diagrams.

## When Invoked

- User asks to "create a diagram", "visualize this", "draw a flowchart"
- Architecture documentation needs visual representation
- System interactions need to be mapped
- Data models need to be visualized as ERDs
- Process flows or decision trees need diagramming

## Supported Diagram Types

| Type | Best for |
|---|---|
| Flowchart (`graph TD/LR`) | Decision trees, process flows, pipelines |
| Sequence (`sequenceDiagram`) | API calls, system interactions |
| Class (`classDiagram`) | Object models, type hierarchies |
| State (`stateDiagram-v2`) | Lifecycle states, workflow stages |
| ER (`erDiagram`) | Database schemas, entity relationships |
| Gantt (`gantt`) | Project timelines, roadmaps |
| C4 Context (`C4Context`) | High-level system architecture |

## Process

1. Understand subject (read code or clarify description)
2. Choose optimal diagram type for the information
3. Create readable diagram with meaningful labels and grouping
4. Deliver with explanation and rendering instructions

## Related

- [quality](../../skills/ak-meta/quality.md) — assess plugin component quality
- [discover](../../skills/ak-meta/discover.md) — generate improvement ideas
