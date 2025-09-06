const express = require('express');
const { generateGridForDate, acquireLock, releaseLock } = require('../utils');

const router = express.Router();

// GET /api/parking-spots?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  // Acquire a lock to prevent reading the file while it's being written to.
  await acquireLock();
  try {
    const { date } = req.query;
    console.log(`[GET /api/parking-spots] Request received: ${JSON.stringify({ date })}`);

    if (!date) {
      console.log(`[GET /api/parking-spots] Missing required query parameters`);
      return res.status(400).json({ message: 'Date query parameter is required' });
    }

    const spots = await generateGridForDate(date);
    res.json(spots);
  } catch (error) {
    console.error('[GET /api/parking-spots] Failed to get parking spots:', error);
    res.status(500).json({ message: 'Error processing parking spot availability.' });
  } finally {
    releaseLock();
  }
});

module.exports = router;
