const router = require('express').Router();
const { generateGridForDate } = require('../utils');

/**
 * @route   GET /api/parking-spots
 * @desc    Obtiene el estado completo de la grilla de estacionamientos para una fecha dada.
 * @access  Public
 * @query   date - La fecha para la cual generar la grilla (formato YYYY-MM-DD).
 */
router.get('/', async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: 'El parámetro "date" es obligatorio.' });
  }

  try {
    const spots = await generateGridForDate(date);
    res.json(spots);
  } catch (error) {
    console.error(`[GET /api/parking-spots] Error al generar la grilla para la fecha ${date}:`, error);
    res.status(500).json({ message: 'Error interno del servidor al generar la grilla de estacionamientos.' });
  }
});

module.exports = router;