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
    const sanitizedRut = validateRut(rut);
    if (!sanitizedRut) {
      return res.status(400).json({ message: 'El RUT es obligatorio y debe tener un formato válido.' });
    }
    const sanitizedLicensePlate = validateLicensePlate(license_plate);
    if (!sanitizedLicensePlate) {
      return res.status(400).json({ message: 'La patente es obligatoria y debe tener un formato válido.' });
    }
    const sanitizedPhoneNumber = validatePhoneNumber(phone_number);
    if (!sanitizedPhoneNumber) {
      return res.status(400).json({ message: 'El teléfono es obligatorio y debe tener un formato internacional válido.' });
    }

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

// DELETE /api/users/:id - Eliminar un usuario (Solo para Admin)
router.delete('/:id', authMiddleware, checkRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Evitar que un administrador se elimine a sí mismo
    if (req.user.id === parseInt(id, 10)) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta de administrador.' });
    }

    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING name', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Gracias a ON DELETE CASCADE, las reservas se eliminan automáticamente.
    res.status(200).json({ message: `El usuario '${result.rows[0].name}' y todas sus reservas han sido eliminados.` });
  } catch (error) {
    console.error(`[DELETE /api/users/${req.params.id}] Failed to delete user:`, error);
    res.status(500).json({ message: 'Error al eliminar el usuario.' });
  }
});

module.exports = router;