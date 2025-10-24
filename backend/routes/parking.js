const express = require('express');
const { generateGridForDate } = require('../services/parkingService');
const { asyncWrapper } = require('../utils');

const router = express.Router();

// GET /api/parking-spots?date=YYYY-MM-DD
router.get('/', asyncWrapper(async (req, res) => {
    const { date } = req.query;
    console.log(`[GET /api/parking-spots] Request received: ${JSON.stringify({ date })}`);

    if (!date) {
        console.log(`[GET /api/parking-spots] Missing required query parameters`);
        return res.status(400).json({ message: 'Date query parameter is required' });
    }

    const spots = await generateGridForDate(date);
    res.json(spots);
}));

module.exports = router;
