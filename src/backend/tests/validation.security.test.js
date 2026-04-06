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

describe('Validation and security checks', () => {
    let mockClient;

    beforeEach(() => {
        jest.clearAllMocks();
        parseRequestUserId.mockReturnValue(1);

        mockClient = {
            query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
            release: jest.fn()
        };

        db.connect.mockResolvedValue(mockClient);
    });

    it('GET /api/workouts/abc returns 400 (invalid ID)', async () => {
        const res = await request(app).get('/api/workouts/abc');
        expect(res.statusCode).toBe(400);
    });

    it('DELETE /api/workouts/abc returns 400 (invalid ID)', async () => {
        const res = await request(app).delete('/api/workouts/abc');
        expect(res.statusCode).toBe(400);
    });

    it('POST /api/workouts rejects oversized title', async () => {
        const res = await request(app).post('/api/workouts').send({
            title: 'x'.repeat(101)
        });

        expect(res.statusCode).toBe(400);
    });

    it('PUT /api/workouts/:id rejects non-array exercise_ids', async () => {
        mockClient.query
            .mockResolvedValueOnce({
                rows: [{ template_id: 1, user_id: 1, title: 'A', notes: null, exercises: [] }],
                rowCount: 1
            })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 }); // ROLLBACK

        const res = await request(app).put('/api/workouts/1').send({
            exercise_ids: '1,2,3'
        });

        expect(res.statusCode).toBe(400);
    });

    it('POST /api/auth/register rejects invalid email format', async () => {
        const res = await request(app).post('/api/auth/register').send({
            username: 'userx',
            email: 'not-an-email',
            password: 'secret123'
        });

        expect(res.statusCode).toBe(400);
    });
});
