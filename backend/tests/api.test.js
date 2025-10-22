// Set environment variables before any other imports
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const app = require('../index');
const db = require('../utils/db');
const jwt = require('jsonwebtoken');
const { generateGridForDate } = require('../utils');


jest.mock('../utils/db');
jest.mock('../utils', () => ({
    ...jest.requireActual('../utils'), // import and retain default behavior
    generateGridForDate: jest.fn(), // mock the specific function
    validateAndCreateReservation: jest.requireActual('../utils').validateAndCreateReservation,
}));


const generateToken = (user) => {
    return jwt.sign(user, process.env.JWT_SECRET);
};

describe('API Tests', () => {
    let token;

    beforeAll(() => {
        token = generateToken({ id: 1, email: 'test@example.com', role: 'user', name: 'Test User' });
    });

    afterEach(() => {
        jest.clearAllMocks(); // Clear mocks after each test
    });


    describe('GET /api/reservations', () => {
        it('should return an array of reservations', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 1, spot_id: 1, date: '2024-12-25', start_time: '09:00', end_time: '10:00' }] });
            const response = await request(app)
                .get('/api/reservations')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/parking-spots', () => {
        it('should return parking spots availability', async () => {
            generateGridForDate.mockResolvedValue(Array(27).fill({ id: 1, isReserved: false }));
            const response = await request(app)
                .get('/api/parking-spots?date=2024-12-25')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        it('should return 400 for missing parameters', async () => {
            await request(app)
                .get('/api/parking-spots')
                .expect(400);
        });

        it('should return 400 for invalid date format', async () => {
             generateGridForDate.mockImplementation(() => {
                const error = new Error('Invalid date format provided to generateGridForDate.');
                error.statusCode = 400;
                throw error;
            });
            await request(app)
                .get('/api/parking-spots?date=invalid')
                .expect(400);
        });
    });

    describe('POST /api/reservations', () => {
        it('should create a new reservation', async () => {
            const reservationData = {
                spotId: 1,
                date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
                startTime: '14:00',
                endTime: '15:00',
            };

            db.query.mockImplementation((query, values) => {
                if (query.includes('SELECT name FROM spots')) {
                    return Promise.resolve({ rows: [{ name: 'Test Spot' }], rowCount: 1 });
                }
                if (query.includes('OVERLAPS')) {
                    return Promise.resolve({ rows: [], rowCount: 0 });
                }
                if (query.includes('INSERT INTO reservations')) {
                    return Promise.resolve({ rows: [{ id: 1, date: new Date(values[2]), start_time: values[3], end_time: values[4] }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            generateGridForDate.mockResolvedValue([]);


            const response = await request(app)
                .post('/api/reservations')
                .set('Authorization', `Bearer ${token}`)
                .send(reservationData)
                .expect(201);

            expect(response.body.newReservation).toHaveProperty('id');
        });

        it('should return 400 for missing fields', async () => {
            const incompleteData = {
                spotId: 1,
                date: '2024-12-25'
            };

            await request(app)
                .post('/api/reservations')
                .set('Authorization', `Bearer ${token}`)
                .send(incompleteData)
                .expect(400);
        });
    });

    describe('DELETE /api/reservations/:id', () => {
        it('should return 404 for non-existent reservation', async () => {
            db.query.mockResolvedValue({ rows: [] });
            await request(app)
                .delete('/api/reservations/non-existent-id')
                .set('Authorization', `Bearer ${token}`)
                .expect(404);
        });
    });
});
