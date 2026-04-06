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

describe('Workout exercises endpoints', () => {
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        parseRequestUserId.mockReturnValue(1);

        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };

        db.connect.mockResolvedValue(mockClient);
    });

    it('GET /api/workouts/exercises returns exercise list', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{ exercise_id: 7, user_id: 1, exercise_name: 'Squat', sets: 3, reps: 8 }],
            rowCount: 1
        });

        const res = await request(app).get('/api/workouts/exercises');

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.exercises)).toBe(true);
        expect(res.body.exercises[0].exercise_name).toBe('Squat');
    });

    it('POST /api/workouts/exercises returns 400 for missing required fields', async () => {
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = await request(app).post('/api/workouts/exercises').send({});

        expect(res.statusCode).toBe(400);
    });

    it('POST /api/workouts/exercises creates exercise', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rows: [{ user_id: 1 }], rowCount: 1 }) // ensure user
            .mockResolvedValueOnce({
                rows: [{
                    exercise_id: 8,
                    user_id: 1,
                    exercise_name: 'Bench Press',
                    notes: null,
                    sets: 3,
                    reps: 10,
                    weight_lbs: 135
                }],
                rowCount: 1
            })
            .mockResolvedValueOnce({}); // COMMIT

        const res = await request(app).post('/api/workouts/exercises').send({
            exercise_name: 'Bench Press',
            sets: 3,
            reps: 10
        });

        expect(res.statusCode).toBe(201);
        expect(res.body.exercise.exercise_id).toBe(8);
    });

    it('PUT /api/workouts/exercises/:exerciseId returns 400 for invalid id', async () => {
        mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

        const res = await request(app).put('/api/workouts/exercises/abc').send({
            exercise_name: 'Updated'
        });

        expect(res.statusCode).toBe(400);
    });

    it('DELETE /api/workouts/exercises/:exerciseId deletes exercise', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{ exercise_id: 9, user_id: 1, exercise_name: 'Row' }],
                rowCount: 1
            })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });

        const res = await request(app).delete('/api/workouts/exercises/9');

        expect(res.statusCode).toBe(200);
        expect(res.body.exercise_id).toBe(9);
    });
});
