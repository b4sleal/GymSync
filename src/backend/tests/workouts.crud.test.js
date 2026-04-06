jest.mock('../config/db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

jest.mock('../utils/validation', () => {
    const actual = jest.requireActual('../utils/validation');
    return {
        ...actual,
        parseRequestUserId: jest.fn(() => 1)
    };
});

const request = require('supertest');
const app = require('../server');
const db = require('../config/db');
const { parseRequestUserId } = require('../utils/validation');

describe('Workout API workflow (stateful)', () => {
    let workouts;
    let nextId;
    let runQuery;

    beforeEach(() => {
        workouts = [];
        nextId = 1;
        parseRequestUserId.mockReturnValue(1);

        runQuery = jest.fn(async (sql, params = []) => {
            const q = sql.replace(/\s+/g, ' ').trim();

            if (q.startsWith('BEGIN') || q.startsWith('COMMIT') || q.startsWith('ROLLBACK')) {
                return { rows: [], rowCount: 0 };
            }

            if (q.includes('SELECT user_id FROM Users WHERE user_id = $1')) {
                return { rows: [{ user_id: 1 }], rowCount: 1 };
            }

            if (q.includes('INSERT INTO WorkoutTemplates')) {
                const [userId, title, notes] = params;
                const row = { template_id: nextId++, user_id: userId, title, notes, exercises: [] };
                workouts.push(row);
                return { rows: [{ template_id: row.template_id }], rowCount: 1 };
            }

            if (q.includes('WHERE wt.template_id = $1')) {
                const id = Number(params[0]);
                const row = workouts.find((w) => w.template_id === id);
                return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
            }

            if (q.includes('WHERE wt.user_id = $1')) {
                const userId = Number(params[0]);
                const rows = workouts.filter((w) => w.user_id === userId);
                return { rows, rowCount: rows.length };
            }

            if (q.includes('UPDATE WorkoutTemplates')) {
                const [title, notes, id] = params;
                const row = workouts.find((w) => w.template_id === Number(id));
                if (!row) return { rows: [], rowCount: 0 };
                row.title = title;
                row.notes = notes;
                return { rows: [], rowCount: 1 };
            }

            if (q.includes('DELETE FROM TemplateExercises')) {
                return { rows: [], rowCount: 0 };
            }

            if (q.includes('DELETE FROM WorkoutTemplates WHERE template_id = $1')) {
                const id = Number(params[0]);
                const before = workouts.length;
                workouts = workouts.filter((w) => w.template_id !== id);
                return { rows: [], rowCount: before - workouts.length };
            }

            return { rows: [], rowCount: 0 };
        });

        db.query.mockReset();
        db.connect.mockReset();
        db.query.mockImplementation(runQuery);
        db.connect.mockResolvedValue({
            query: runQuery,
            release: jest.fn()
        });
    });

    it('POST /api/workouts with missing title returns 400', async () => {
        const res = await request(app).post('/api/workouts').send({});
        expect(res.statusCode).toBe(400);
    });

    it('POST -> GET returns matching workout data', async () => {
        const createRes = await request(app).post('/api/workouts').send({
            title: 'Push Day',
            notes: 'Chest focus'
        });

        expect(createRes.statusCode).toBe(201);
        const createdId = createRes.body.workout.template_id;
        expect(createRes.body.workout.title).toBe('Push Day');
        expect(createRes.body.workout.notes).toBe('Chest focus');

        const getRes = await request(app).get(`/api/workouts/${createdId}`);

        expect(getRes.statusCode).toBe(200);
        expect(getRes.body.workout.template_id).toBe(createdId);
        expect(getRes.body.workout.title).toBe('Push Day');
        expect(getRes.body.workout.notes).toBe('Chest focus');
    });

    it('PUT updates workout and GET returns updated data', async () => {
        const createRes = await request(app).post('/api/workouts').send({
            title: 'Old Title',
            notes: 'old'
        });
        const id = createRes.body.workout.template_id;

        const updateRes = await request(app).put(`/api/workouts/${id}`).send({
            title: 'New Title',
            notes: 'new'
        });
        expect(updateRes.statusCode).toBe(200);

        const getRes = await request(app).get(`/api/workouts/${id}`);
        expect(getRes.statusCode).toBe(200);
        expect(getRes.body.workout.title).toBe('New Title');
        expect(getRes.body.workout.notes).toBe('new');
    });

    it('DELETE removes workout, then GET returns 400', async () => {
        const createRes = await request(app).post('/api/workouts').send({
            title: 'Delete Me',
            notes: 'temp'
        });
        const id = createRes.body.workout.template_id;

        const deleteRes = await request(app).delete(`/api/workouts/${id}`);
        expect(deleteRes.statusCode).toBe(200);

        const getRes = await request(app).get(`/api/workouts/${id}`);
        expect(getRes.statusCode).toBe(400);
    });
})
