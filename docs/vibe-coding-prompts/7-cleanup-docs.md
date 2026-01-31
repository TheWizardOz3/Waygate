# Cleanup Documentation Context

Review and compress the documentation files to reduce context consumption while preserving critical architectural knowledge.

## Files to Review

1. `docs/changelog.md`
2. `docs/decision_log.md`
3. `docs/project_status.md`

## Cleanup Guidelines

### Changelog (`docs/changelog.md`)

**Archive old versions:**

- Move entries older than the current major version to `docs/archive/changelog-v{X}.md`
- Keep only current major version and recent minor versions in the main file

**Compress entries:**

- Remove task-level breakdowns (e.g., "Task 1: Database Schema")
- Remove file paths and function names
- Remove implementation details (e.g., specific methods, module structures)
- Keep: Feature name, 2-5 sentence description of what changed and why it matters
- Keep: Breaking changes, security fixes, migration notes

### Decision Log (`docs/decision_log.md`)

**Archive completed setup ADRs:**

- Move one-time setup/infrastructure ADRs to `docs/archive/decision-log-setup.md`
- These are decisions embedded in code that don't need ongoing reference

**Prune active ADRs:**

- Remove "Migration" sections for completed migrations
- Condense "Trigger" sections to 1-2 sentences
- Keep: Decision, Rationale (condensed), AI Instructions (these guide future development)

**Condense old ADRs:**

- ADRs for features that are stable and rarely touched can be shortened to: Decision + AI Instructions only

### Project Status (`docs/project_status.md`)

**Remove duplication:**

- Remove any "Recent Enhancements" sections that duplicate changelog content

**Compress completed milestones:**

- Keep: Milestone name, completion date, 1-sentence summary
- Remove: Detailed feature tables, test counts, task breakdowns

**Keep current:**

- Current milestone details (in progress features, blockers)
- Future milestone summaries
- Task status tracking within current milestone

## Process

1. Create `docs/archive/` folder if it doesn't exist
2. Archive old changelog entries
3. Archive setup ADRs
4. Compress remaining content in each file
5. Verify no critical context was lost

## Target Outcome

Reduce total documentation lines by 50-70% while preserving:

- Current milestone context and task status
- Active architectural decisions that guide future code
- Recent changelog entries for understanding current state
