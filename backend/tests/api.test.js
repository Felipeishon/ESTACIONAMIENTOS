const request = require('supertest');
const app = require('../index');

describe('API Tests', () => {
    describe('GET /api/reservations', () => {
        it('should return an array of reservations', async () => {
            const response = await request(app)
                .get('/api/reservations')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('GET /api/parking-spots', () => {
        it('should return parking spots availability', async () => {
            const response = await request(app)
                .get('/api/parking-spots?date=2024-12-25&startTime=09:00&endTime=10:00')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(27); // NUMBER_OF_SPOTS
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0]).toHaveProperty('isReserved');
        });

        it('should return 400 for missing parameters', async () => {
            await request(app)
                .get('/api/parking-spots')
                .expect(400);
        });

        it('should return 400 for invalid date format', async () => {
            await request(app)
                .get('/api/parking-spots?date=invalid&startTime=09:00&endTime=10:00')
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
                email: 'test@example.com'
            };

            const response = await request(app)
                .post('/api/reservations')
                .send(reservationData)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.spotId).toBe(reservationData.spotId);
            expect(response.body.email).toBe(reservationData.email);
        });

        it('should return 400 for missing fields', async () => {
            const incompleteData = {
                spotId: 1,
                date: '2024-12-25'
            };

            await request(app)
                .post('/api/reservations')
                .send(incompleteData)
                .expect(400);
        });

        it('should return 400 for invalid spotId', async () => {
            const invalidData = {
                spotId: 20, // Invalid spot ID
                date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
                startTime: '14:00',
                endTime: '15:00',
                email: 'test@example.com'
            };

            await request(app)
                .post('/api/reservations')
                .send(invalidData)
                .expect(400);
        });

        it('should return 400 for past dates', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);
            const dateString = pastDate.toISOString().split('T')[0];

            const reservationData = {
                spotId: 1,
                date: dateString,
                startTime: '14:00',
                endTime: '15:00',
                email: 'test@example.com'
            };

            await request(app)
                .post('/api/reservations')
                .send(reservationData)
                .expect(400);
        });
    });

    describe('DELETE /api/reservations/:id', () => {
        it('should return 404 for non-existent reservation', async () => {
            await request(app)
                .delete('/api/reservations/non-existent-id')
                .expect(404);
        });
    });
});
