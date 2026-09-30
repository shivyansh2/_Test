# Bug Report

Found by reading `src/` and then writing tests. Bugs marked **(test.failing)** have a
`test.failing` test in `tests/` that documents the bug: the suite stays green now, and
that test will start failing when the bug is fixed, which is the prompt to turn it into
a normal test.

## Fixed

### 1. Pagination skips the first page — FIXED
- **Where:** `src/services/taskService.js`, `getPaginated`
- **Expected:** `?page=1&limit=2` returns tasks 1-2, `page=2` returns tasks 3-4.
- **Actual:** `page=1` returned tasks 3-4 and the first `limit` tasks were unreachable.
- **Why:** `offset = page * limit` treats pages as 0-based, but the route defaults to and documents `page=1` as the first page.
- **How found:** Pagination tests with 5 tasks. Page 1 did not return the first tasks.
- **Fix:** `offset = (page - 1) * limit`. Covered by `getPaginated` unit tests and the `?page=&limit=` route test.

## Open

### 2. Status filter matches substrings (test.failing)
- **Where:** `taskService.js`, `getByStatus`
- **Expected:** `?status=done` returns only `done` tasks; an unknown status returns `[]`.
- **Actual:** `?status=do` returns every `todo` and `done` task, and `?status=in` returns `in_progress`.
- **Why:** `t.status.includes(status)` is a substring check. The route also never validates the query value.
- **Fix:** `t.status === status`, and optionally return 400 for a status not in `VALID_STATUSES`.

### 3. Completing a task resets its priority (test.failing)
- **Where:** `taskService.js`, `completeTask`
- **Expected:** Only `status` and `completedAt` change.
- **Actual:** `priority` is forced to `'medium'`, so completing a high-priority task loses that data. Completing an already-done task also overwrites its original `completedAt`.
- **Why:** The hard-coded `priority: 'medium'` in the object spread.
- **Fix:** Remove that line, and return the task unchanged if it is already `done`.

### 4. `page` / `limit` values are not validated
- **Where:** `routes/tasks.js`, `GET /`
- **Expected:** Invalid values give 400 or fall back to sensible defaults.
- **Actual:** `parseInt(x) || 1` fixes `0` and `abc`, but negative numbers pass through. A negative page yields a negative `slice` offset, and a huge or negative `limit` is accepted.
- **Fix:** Clamp `page >= 1` and `1 <= limit <= 100`, or return 400.

### 5. `status` overrides pagination (test.failing)
- **Where:** `routes/tasks.js`, `GET /`
- **Expected:** `?status=todo&page=2&limit=2` filters and then paginates.
- **Actual:** The `status` branch returns early and `page`/`limit` are silently ignored.
- **Fix:** Filter first, then paginate the filtered list.

### 6. `PUT` can overwrite protected fields (test.failing)
- **Where:** `taskService.js`, `update`, with `validators.js`
- **Expected:** Clients can change title, description, status, priority and dueDate only.
- **Actual:** `{ ...tasks[index], ...fields }` copies the whole body, so `id`, `createdAt` and `completedAt` can be overwritten. Setting `status: 'done'` via `PUT` also leaves `completedAt` as `null`, which is inconsistent with `PATCH /complete`.
- **Fix:** Whitelist the updatable fields, and set or clear `completedAt` when status changes.

### 7. Docs disagree with the code (not a code bug)
The README lists statuses as `pending | in-progress | completed`, but the validators, stats and ASSIGNMENT.md use `todo | in_progress | done`. I followed the code.
