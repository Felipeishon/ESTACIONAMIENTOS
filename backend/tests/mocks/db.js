// backend/tests/mocks/db.js
const mockDb = {
    query: jest.fn(),
    getClient: jest.fn(() => ({
        query: jest.fn(),
        release: jest.fn(),
    })),
};

mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });
mockDb.getClient.mockReturnValue({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
});

module.exports = mockDb;
