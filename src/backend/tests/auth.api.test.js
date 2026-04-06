jest.mock('../config/db', () => ({
    query: jest.fn(),
    connect: jest.fn()
}));

jest.mock('bcrypt', () => ({
    hash: jest.fn(),
    compare: jest.fn()
}));

const request = require('supertest');
const app = require('../server');
const db = require('../config/db');
const bcrypt = require('bcrypt');

describe('Auth API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('POST /api/auth/register returns 400 when required fields are missing', async () => {
        const res = await request(app).post('/api/auth/register').send({});
        expect(res.statusCode).toBe(400);
    });

    it('POST /api/auth/register returns 400 for duplicate username/email', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ user_id: 1 }], rowCount: 1 });

        const res = await request(app).post('/api/auth/register').send({
            username: 'taken',
            email: 'taken@example.com',
            password: 'secret123'
        });

        expect(res.statusCode).toBe(400);
    });

    it('POST /api/auth/register returns 201 for valid user', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [], rowCount: 0 })
            .mockResolvedValueOnce({
                rows: [{ user_id: 22, username: 'newuser', email: 'newuser@example.com' }],
                rowCount: 1
            });

        bcrypt.hash.mockResolvedValue('hashed_pw');

        const res = await request(app).post('/api/auth/register').send({
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'secret123'
        });

        expect(res.statusCode).toBe(201);
        expect(res.body.userId).toBe(22);
    });

    it('POST /api/auth/login returns 401 for wrong password', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                user_id: 22,
                username: 'newuser',
                email: 'newuser@example.com',
                password_hash: 'hashed_pw'
            }],
            rowCount: 1
        });

        bcrypt.compare.mockResolvedValue(false);

        const res = await request(app).post('/api/auth/login').send({
            identifier: 'newuser',
            password: 'wrongpass'
        });

        expect(res.statusCode).toBe(401);
    });

    it('POST /api/auth/login returns 200 for valid credentials', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                user_id: 22,
                username: 'newuser',
                email: 'newuser@example.com',
                password_hash: 'hashed_pw'
            }],
            rowCount: 1
        });

        bcrypt.compare.mockResolvedValue(true);

        const res = await request(app).post('/api/auth/login').send({
            identifier: 'newuser',
            password: 'secret123'
        });

        expect(res.statusCode).toBe(200);
        expect(res.body.userId).toBe(22);
    });
});
