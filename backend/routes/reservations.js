const router = require('express').Router();
const config = require('../config');
const db = require('../utils/db');
const {
    isHoliday,
    generateGridForDate,
    getMyActiveReservations,
    sendReservationConfirmationEmail,
    sendReservationCancellationEmail,
    sendWeekendCoordinationEmail,
    validateAndCreateReservation,
} = require('../utils');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

// Helper function to get all reservations for an admin
const getAllAdminReservations = async () => {
    const result = await db.query(`
        SELECT r.id, r.spot_id, s.name as "spotName", r.date, r.start_time, r.end_time, u.name, u.email
        FROM reservations r
        JOIN spots s ON r.spot_id = s.id
        JOIN users u ON r.user_id = u.id
        WHERE r.date >= CURRENT_DATE
        ORDER BY r.date, r.start_time
    `);
    return result.rows;
};

// GET /api/reservations
router.get('/', authMiddleware, async (req, res) => {
  try {
    let reservations;
    if (req.user.role === 'admin') {
      reservations = await getAllAdminReservations();
    } else {
      reservations = await getMyActiveReservations(req.user.id);
    }
    res.json(reservations);
  } catch (error) {
    console.error('[GET /api/reservations] Failed to get reservations:', error);
    res.status(500).json({ message: 'Error al recuperar las reservas de la base de datos.' });
  }
});

// POST /api/reservations
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { newReservation, requestDate } = await validateAndCreateReservation(req.body, req.user);

    // Asegurarse de que la fecha para el correo sea un string YYYY-MM-DD para evitar problemas de zona horaria en la plantilla.
    const emailData = { ...newReservation, date: newReservation.date.split('T')[0] };

    sendReservationConfirmationEmail(emailData).catch(console.error);

    if ((requestDate.getDay() === 0 || requestDate.getDay() === 6) && config.coordinationEmail) {
        sendWeekendCoordinationEmail(newReservation, config.coordinationEmail).catch(console.error);
    }

    const gridState = await generateGridForDate(newReservation.date);
    const myActiveReservations = await getMyActiveReservations(req.user.id);
    res.status(201).json({ message: 'Reserva creada con éxito', newReservation, gridState, gridDate: newReservation.date, myReservations: myActiveReservations });

  } catch (error) {
    if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('[POST /api/reservations] Failed to create reservation:', error);
    res.status(500).json({ message: 'Error al guardar la reserva.' });
  }
});

// DELETE /api/reservations/admin/all - ADMIN ONLY
router.delete('/admin/all', authMiddleware, checkRole(['admin']), async (req, res) => {
    try {
        await db.query('TRUNCATE TABLE reservations RESTART IDENTITY');
        res.status(200).json({ message: 'Todas las reservas han sido eliminadas.' });
    } catch (error) {
        console.error(`[DELETE /api/reservations/admin/all] Failed:`, error);
        res.status(500).json({ message: 'Error al eliminar todas las reservas.' });
    }
});

// DELETE /api/reservations/:id - User or Admin
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, email, role } = req.user;

    const result = await db.query(
        `SELECT r.*, u.email, u.name, s.name as "spotName"
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         JOIN spots s ON r.spot_id = s.id
         WHERE r.id = $1`,
        [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }
    const reservationToDelete = result.rows[0];
    
    if (role !== 'admin' && userId !== reservationToDelete.user_id) {
      return res.status(403).json({ message: 'No tiene permiso para eliminar esta reserva.' });
    }

    await db.query('DELETE FROM reservations WHERE id = $1', [id]);

    // Formatear el objeto para que coincida con lo que espera la función de email
    const emailData = {
        email: reservationToDelete.email,
        name: reservationToDelete.name,
        spotName: reservationToDelete.spotName,
        date: new Date(reservationToDelete.date).toISOString().split('T')[0], // <-- CORRECCIÓN
        start_time: reservationToDelete.start_time,
        end_time: reservationToDelete.end_time,
    };
    sendReservationCancellationEmail(emailData).catch(err => {
        console.error(`[DELETE /api/reservations/${id}] Sending cancellation email failed:`, err);
    });

    // Asegurarse de que la fecha esté en formato YYYY-MM-DD para la grilla
    const gridDate = new Date(reservationToDelete.date).toISOString().split('T')[0];
    const gridState = await generateGridForDate(gridDate);
    
    // Devuelve siempre las reservas actualizadas del usuario que realiza la acción (sea admin o no)
    const myActiveReservations = (role === 'admin') ? await getAllAdminReservations() : await getMyActiveReservations(userId);

    res.status(200).json({
      message: 'Reserva eliminada con éxito',
      gridState,
      gridDate,
      myReservations: myActiveReservations,
    });
  } catch (error) {
    console.error(`[DELETE /api/reservations/${req.params.id}] Failed:`, error);
    res.status(500).json({ message: 'Error al eliminar la reserva.' });
  }
});

module.exports = router;