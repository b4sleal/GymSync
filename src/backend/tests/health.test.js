jest.mock('../config/db', () => ({
    query: jest.fn()
}));

const request = require('supertest');
const app = require('../server');

describe('health endpoints', () => {
    it('GET /health returns 200', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('GET /api/health returns 200', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});
