# Schema Quick Reference

`schema.yaml` in this directory is the canonical contract for `docs/solutions/` frontmatter.

## Tracks

The `problem_type` field determines which **track** applies:

| Track | problem_types | Description |
|-------|--------------|-------------|
| **Bug** | `build_error`, `test_failure`, `runtime_error`, `performance_issue`, `database_issue`, `security_issue`, `ui_bug`, `integration_issue`, `logic_error` | Defects and failures |
| **Knowledge** | `best_practice`, `documentation_gap`, `workflow_issue`, `developer_experience` | Practices, patterns, improvements |

## Required Fields (both tracks)

- **module**: Module or area affected
- **date**: ISO date `YYYY-MM-DD`
- **problem_type**: See Tracks table
- **component**: One of `model`, `controller`, `view`, `service`, `api`, `database`, `frontend`, `backend`, `cli`, `config`, `testing`, `docs`, `tooling`, `middleware`, `infrastructure`, `plugin`
- **severity**: One of `critical`, `high`, `medium`, `low`

## Bug Track — Additional Required Fields

- **symptoms**: Array (1-5 items) of observable symptoms
- **root_cause**: One of `missing_association`, `missing_include`, `missing_index`, `wrong_api`, `scope_issue`, `thread_violation`, `async_timing`, `memory_leak`, `config_error`, `logic_error`, `test_isolation`, `missing_validation`, `missing_permission`, `missing_workflow_step`, `inadequate_documentation`, `missing_tooling`, `incomplete_setup`
- **resolution_type**: One of `code_fix`, `migration`, `config_change`, `test_fix`, `dependency_update`, `environment_setup`, `workflow_improvement`, `documentation_update`, `tooling_addition`, `seed_data_update`

## Knowledge Track — Optional Fields

- **applies_when**: Conditions where this guidance applies
- **symptoms**, **root_cause**, **resolution_type**: All optional

## Optional Fields (both tracks)

- **related_components**: Other components involved
- **tags**: Search keywords, lowercase and hyphen-separated (max 8)

## Category Mapping

Each `problem_type` maps to a `docs/solutions/` subdirectory:

| problem_type | Directory |
|-------------|-----------|
| `build_error` | `build-errors/` |
| `test_failure` | `test-failures/` |
| `runtime_error` | `runtime-errors/` |
| `performance_issue` | `performance-issues/` |
| `database_issue` | `database-issues/` |
| `security_issue` | `security-issues/` |
| `ui_bug` | `ui-bugs/` |
| `integration_issue` | `integration-issues/` |
| `logic_error` | `logic-errors/` |
| `developer_experience` | `developer-experience/` |
| `workflow_issue` | `workflow-issues/` |
| `best_practice` | `best-practices/` |
| `documentation_gap` | `documentation-gaps/` |

## Validation

1. Determine track from `problem_type`
2. Verify all shared required fields are present
3. For bug track: verify `symptoms`, `root_cause`, `resolution_type` are present
4. Enum fields must match allowed values exactly
5. `date` must match `YYYY-MM-DD`
6. `tags` should be lowercase and hyphen-separated
