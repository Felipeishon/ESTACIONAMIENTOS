const router = require('express').Router();
const db = require('../utils/db');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// GET /api/users/count
router.get('/count', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM users');
    const count = parseInt(result.rows[0].count, 10);
    res.json({ count });
  } catch (error) {
    console.error('[GET /api/users/count] Failed to get user count:', error);
    res.status(500).json({ message: 'Error al obtener el número de usuarios.' });
  }
});

// GET /api/users
router.get('/', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('[GET /api/users] Failed to get users:', error);
    res.status(500).json({ message: 'Error al obtener los usuarios.' });
  }
});

module.exports = router;