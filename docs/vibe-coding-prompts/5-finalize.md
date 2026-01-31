# Finalize Feature

Finalize **[FEATURE NAME]**:

1. Run `pnpm lint` and `pnpm type-check` - fix any errors

2. Update `docs/Features/[feature-name].md` with implementation summary (if feature doc exists)

3. Update `docs/changelog.md`:
   - Add **one concise entry** (2-5 sentences) describing the user-facing change
   - Focus on _what_ and _why_, not implementation details
   - No file paths, function names, or task breakdowns

4. Update `docs/project_status.md`:
   - Update task status in the Task Status table
   - Move feature to Completed Milestones table if milestone is done
   - Update "Last Updated" date

5. Update `docs/decision_log.md` **only if** you made architectural decisions that affect how future code should be written

6. Prepare a conventional commit message

Start with step 1.
