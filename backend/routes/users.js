const router = require('express').Router();
const db = require('../utils/db');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const {
  validateRut,
  validatePhoneNumber,
  validateLicensePlate,
} = require('../utils/validators');

// GET /api/users - Obtener todos los usuarios (Solo para Admin)
router.get('/', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, rut, license_plate, phone_number FROM users ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('[GET /api/users] Failed to get users:', error);
    res.status(500).json({ message: 'Error al obtener los usuarios.' });
  }
});

// PUT /api/users/:id - Actualizar un usuario (Solo para Admin)
router.put('/:id', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rut, license_plate, phone_number, role } = req.body;

    // Validar los datos que vienen del formulario
    const sanitizedRut = rut ? validateRut(rut) : null;
    const sanitizedLicensePlate = license_plate ? validateLicensePlate(license_plate) : null;
    const sanitizedPhoneNumber = phone_number ? validatePhoneNumber(phone_number) : null;

    // Opcional: Validar que el nuevo rol sea válido
    const validRoles = ['admin', 'user'];
    const sanitizedRole = role && validRoles.includes(role) ? role : 'user';

    const result = await db.query(
      `UPDATE users 
       SET name = $1, rut = $2, license_plate = $3, phone_number = $4, role = $5
       WHERE id = $6
       RETURNING id, name, email, role, rut, license_plate, phone_number`,
      [name, sanitizedRut, sanitizedLicensePlate, sanitizedPhoneNumber, sanitizedRole, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    res.status(200).json({
      message: 'Usuario actualizado exitosamente.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error(`[PUT /api/users/${req.params.id}] Failed to update user:`, error);
    res.status(500).json({ message: 'Error al actualizar el usuario.' });
  }
});

module.exports = router;