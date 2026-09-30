const taskService = require('../src/services/taskService');

const past = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  test('applies defaults for optional fields', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
      assignee: null,
    });
    expect(typeof task.id).toBe('string');
    expect(Number.isNaN(Date.parse(task.createdAt))).toBe(false);
  });

  test('keeps provided fields and generates unique ids', () => {
    const a = taskService.create({ title: 'A', priority: 'high', status: 'in_progress' });
    const b = taskService.create({ title: 'B' });

    expect(a.priority).toBe('high');
    expect(a.status).toBe('in_progress');
    expect(a.id).not.toBe(b.id);
  });
});

describe('getAll / findById', () => {
  test('getAll returns every task', () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    expect(taskService.getAll()).toHaveLength(2);
  });

  test('getAll returns a copy, so pushing to it does not change the store', () => {
    taskService.create({ title: 'A' });
    taskService.getAll().push({ id: 'fake' });
    expect(taskService.getAll()).toHaveLength(1);
  });

  test('findById returns the task, or undefined when missing', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.findById(task.id)).toEqual(task);
    expect(taskService.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'in_progress' });
    taskService.create({ title: 'C', status: 'done' });
  });

  test('returns only tasks with the exact status', () => {
    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  test('returns an empty array when nothing matches', () => {
    expect(taskService.getByStatus('nonexistent')).toEqual([]);
  });

  // BUG 2: getByStatus uses String.includes, so partial values match.
  test.failing('does not match on a partial status string', () => {
    expect(taskService.getByStatus('do')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) taskService.create({ title: `Task ${i}` });
  });

  test('page 1 returns the first `limit` tasks', () => {
    const result = taskService.getPaginated(1, 2);
    expect(result.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
  });

  test('page 2 returns the next tasks', () => {
    const result = taskService.getPaginated(2, 2);
    expect(result.map((t) => t.title)).toEqual(['Task 3', 'Task 4']);
  });

  test('last page can be partial', () => {
    const result = taskService.getPaginated(3, 2);
    expect(result.map((t) => t.title)).toEqual(['Task 5']);
  });

  test('a page beyond the data returns an empty array', () => {
    expect(taskService.getPaginated(10, 2)).toEqual([]);
  });
});

describe('getStats', () => {
  test('returns zeros when there are no tasks', () => {
    expect(taskService.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts tasks by status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'todo' });
    taskService.create({ title: 'C', status: 'in_progress' });
    taskService.create({ title: 'D', status: 'done' });

    expect(taskService.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1 });
  });

  test('counts only unfinished tasks with a past due date as overdue', () => {
    taskService.create({ title: 'overdue todo', dueDate: past() });
    taskService.create({ title: 'overdue in progress', status: 'in_progress', dueDate: past() });
    taskService.create({ title: 'done but past due', status: 'done', dueDate: past() });
    taskService.create({ title: 'due in future', dueDate: future() });
    taskService.create({ title: 'no due date' });

    expect(taskService.getStats().overdue).toBe(2);
  });
});

describe('update', () => {
  test('merges the given fields into the task', () => {
    const task = taskService.create({ title: 'Old' });
    const updated = taskService.update(task.id, { title: 'New', priority: 'high' });

    expect(updated).toMatchObject({ id: task.id, title: 'New', priority: 'high' });
    expect(taskService.findById(task.id).title).toBe('New');
  });

  test('returns null when the task does not exist', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  // BUG 3: update spreads the raw body, so protected fields can be overwritten.
  test.failing('does not let callers overwrite id or createdAt', () => {
    const task = taskService.create({ title: 'A' });
    const updated = taskService.update(task.id, { id: 'hacked', createdAt: '2000-01-01T00:00:00.000Z' });

    expect(updated.id).toBe(task.id);
    expect(updated.createdAt).toBe(task.createdAt);
  });
});

describe('remove', () => {
  test('deletes an existing task and returns true', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.getAll()).toHaveLength(0);
  });

  test('returns false when the task does not exist', () => {
    expect(taskService.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('marks the task done and sets completedAt', () => {
    const task = taskService.create({ title: 'A' });
    const done = taskService.completeTask(task.id);

    expect(done.status).toBe('done');
    expect(Number.isNaN(Date.parse(done.completedAt))).toBe(false);
    expect(taskService.findById(task.id).status).toBe('done');
  });

  test('returns null when the task does not exist', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });

  // BUG 4: completeTask hard-codes priority to 'medium'.
  test.failing('keeps the original priority', () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    expect(taskService.completeTask(task.id).priority).toBe('high');
  });
});

describe('assignTask', () => {
  test('stores the assignee on the task and returns it', () => {
    const task = taskService.create({ title: 'A' });
    const assigned = taskService.assignTask(task.id, 'Priya');

    expect(assigned.assignee).toBe('Priya');
    expect(taskService.findById(task.id).assignee).toBe('Priya');
  });

  test('trims surrounding whitespace', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.assignTask(task.id, '  Priya  ').assignee).toBe('Priya');
  });

  test('replaces an existing assignee', () => {
    const task = taskService.create({ title: 'A' });
    taskService.assignTask(task.id, 'Priya');
    expect(taskService.assignTask(task.id, 'Sam').assignee).toBe('Sam');
  });

  test('returns null when the task does not exist', () => {
    expect(taskService.assignTask('nope', 'Priya')).toBeNull();
  });
});
