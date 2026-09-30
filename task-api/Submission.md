# Submission Notes

## What was done
- **Tests** (`task-api/tests/`): unit tests for `taskService` plus Supertest integration tests for every endpoint, including happy paths and edge cases.
- **Bug report:** `BUG_REPORT.md`, with location, cause, how it was found, and the fix for each bug.
- **Fix (Part B):** Bug 1, the pagination offset. One-line change in `getPaginated`.
- **Feature (Part C):** `PATCH /tasks/:id/assign`.

## Design decisions for `assign`
- **Validation:** `assignee` must be a non-empty string after trimming, at most 100 characters. Missing, `null`, non-string, empty and whitespace-only values return 400. Stored names are trimmed.
- **Order of checks:** body validation runs before the lookup, matching the existing `PUT` handler, so a bad body returns 400 even for an unknown id.
- **Already assigned:** reassignment is allowed and returns 200 with the new name, because tasks get handed off in practice. A 409 would be safer if reassignment needed to be deliberate. That is a product question.
- **Task shape:** new tasks now include `assignee: null`, so the field is always present.
- **Unassigning:** not supported, since empty strings are rejected. I would add `DELETE /tasks/:id/assign` rather than overload this endpoint.

## Tests that document known bugs
Bugs 2, 3, 5 and 6 have `test.failing` tests. They pass while the bug exists and will fail once it is fixed, so whoever fixes the bug converts them to normal tests.

## What I'd test next
- Fixes for bugs 2-6, and validation of `page`/`limit`.
- `PUT` and `POST` with malformed JSON or a non-object body.
- Behavior around `completedAt` when status changes through `PUT`.
- Concurrency and larger datasets, once a real data store replaces the in-memory array.

## What surprised me
- `completeTask` silently resets priority, which looks like a leftover rather than intent.
- The README and code use different status names.
- `getAll` copies the array but not the task objects, so callers share references with the store.

## Questions before shipping
- Should a task be reassignable, and should there be a way to unassign?
- Should `PUT` be a true full replace, or a partial update as it behaves now?
- What are the intended limits for `limit`, and should responses include total count and page metadata?
- Is there authentication? At the moment anyone can assign, edit or delete any task.
