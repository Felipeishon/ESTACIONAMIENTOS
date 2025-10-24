const router = require('express').Router();
const db = require('../utils/db');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const { asyncWrapper } = require('../utils');
const { updateUserChecks, handleValidationErrors } = require('../middleware/validators');

// GET /api/users - Obtener todos los usuarios (Solo para Admin)
router.get('/', authMiddleware, checkRole(['admin']), asyncWrapper(async (req, res) => {
  const result = await db.query('SELECT id, name, email, role, rut, license_plate, phone_number FROM users ORDER BY name');
  res.json(result.rows);
}));

// PUT /api/users/:id - Actualizar un usuario (Solo para Admin)
router.put('/:id',
    authMiddleware,
    checkRole(['admin']),
    updateUserChecks,
    handleValidationErrors,
    asyncWrapper(async (req, res) => {
        const { id } = req.params;
        // Los datos del body ya vienen sanitizados por el middleware de validación
        const { name, rut, license_plate, phone_number, role } = req.body;

        const result = await db.query(
            `UPDATE users 
             SET name = $1, rut = $2, license_plate = $3, phone_number = $4, role = $5
             WHERE id = $6
             RETURNING id, name, email, role, rut, license_plate, phone_number`,
            [name, rut, license_plate, phone_number, role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({
            message: 'Usuario actualizado exitosamente.',
            user: result.rows[0],
        });
    })
);

// DELETE /api/users/:id - Eliminar un usuario (Solo para Admin)
router.delete('/:id', authMiddleware, checkRole(['admin']), asyncWrapper(async (req, res) => {
  const { id } = req.params;

  if (req.user.id === parseInt(id, 10)) {
    return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta de administrador.' });
  }

  const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING name', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Usuario no encontrado.' });
  }

  res.status(200).json({ message: `El usuario '${result.rows[0].name}' y todas sus reservas han sido eliminados.` });
}));

module.exports = router;