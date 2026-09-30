const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

const past = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const createTask = async (body = { title: 'Test task' }) => {
  const res = await request(app).post('/tasks').send(body);
  return res.body;
};

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  test('creates a task and returns 201', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', priority: 'high', status: 'todo' });
    expect(res.body.id).toBeDefined();
  });

  test.each([
    ['missing title', {}],
    ['empty title', { title: '' }],
    ['whitespace title', { title: '   ' }],
    ['non-string title', { title: 123 }],
    ['invalid status', { title: 'x', status: 'blocked' }],
    ['invalid priority', { title: 'x', priority: 'urgent' }],
    ['invalid dueDate', { title: 'x', dueDate: 'not-a-date' }],
  ])('returns 400 for %s', async (_name, body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('GET /tasks', () => {
  test('returns an empty list when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    await createTask({ title: 'A' });
    await createTask({ title: 'B' });

    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    await createTask({ title: 'A', status: 'todo' });
    await createTask({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=done');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  test('paginates: page 1 returns the first tasks, page 2 the next', async () => {
    for (let i = 1; i <= 5; i++) await createTask({ title: `Task ${i}` });

    const page1 = await request(app).get('/tasks?page=1&limit=2');
    const page2 = await request(app).get('/tasks?page=2&limit=2');

    expect(page1.body.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
    expect(page2.body.map((t) => t.title)).toEqual(['Task 3', 'Task 4']);
  });

  test('falls back to page 1 / limit 10 when values are not numbers', async () => {
    for (let i = 1; i <= 12; i++) await createTask({ title: `Task ${i}` });

    const res = await request(app).get('/tasks?page=abc&limit=xyz');
    expect(res.body).toHaveLength(10);
    expect(res.body[0].title).toBe('Task 1');
  });

  // BUG 5: the status branch returns early, so page/limit are ignored.
  test.failing('applies pagination together with a status filter', async () => {
    for (let i = 1; i <= 4; i++) await createTask({ title: `Task ${i}`, status: 'todo' });

    const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
    expect(res.body).toHaveLength(2);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const task = await createTask({ title: 'Old' });

    const res = await request(app).put(`/tasks/${task.id}`).send({ title: 'New', status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, title: 'New', status: 'in_progress' });
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid data', async () => {
    const task = await createTask();
    const res = await request(app).put(`/tasks/${task.id}`).send({ title: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task and returns 204', async () => {
    const task = await createTask();

    const res = await request(app).delete(`/tasks/${task.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get('/tasks');
    expect(list.body).toHaveLength(0);
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/tasks/nope');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks a task as done', async () => {
    const task = await createTask();

    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('returns 404 for an unknown id', async () => {
    const res = await request(app).patch('/tasks/nope/complete');
    expect(res.status).toBe(404);
  });

  // BUG 3 through the API.
  test.failing('does not change the priority of a completed task', async () => {
    const task = await createTask({ title: 'A', priority: 'high' });
    const res = await request(app).patch(`/tasks/${task.id}/complete`);
    expect(res.body.priority).toBe('high');
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts by status and the overdue count', async () => {
    await createTask({ title: 'A', status: 'todo', dueDate: past() });
    await createTask({ title: 'B', status: 'in_progress' });
    await createTask({ title: 'C', status: 'done', dueDate: past() });

    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a task and returns the updated task', async () => {
    const task = await createTask();

    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Priya' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, assignee: 'Priya' });
  });

  test('the assignment is visible on later reads', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Priya' });

    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Priya');
  });

  test('trims whitespace around the name', async () => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '  Priya  ' });
    expect(res.body.assignee).toBe('Priya');
  });

  test('allows reassigning an already assigned task', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Priya' });

    const res = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Sam' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Sam');
  });

  test('returns 404 when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Priya' });
    expect(res.status).toBe(404);
  });

  test.each([
    ['missing assignee', {}],
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['non-string', { assignee: 42 }],
    ['null', { assignee: null }],
    ['too long', { assignee: 'x'.repeat(101) }],
  ])('returns 400 for %s', async (_name, body) => {
    const task = await createTask();
    const res = await request(app).patch(`/tasks/${task.id}/assign`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('does not modify the task when validation fails', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '' });

    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBeNull();
  });
});
