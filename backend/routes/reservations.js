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
    const { spotId, date, startTime, endTime } = req.body;
    const { id: userId, email, name } = req.user; // Get user info from token

    if (!spotId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const requestDate = new Date(`${date}T00:00:00`);
    if (isNaN(requestDate.getTime())) {
        return res.status(400).json({ message: 'Formato de fecha inválido.' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestDate < today) {
        return res.status(400).json({ message: 'No se pueden hacer reservas para fechas pasadas.' });
    }

    const maxDate = new Date();
    maxDate.setHours(0, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + 14);
    if (requestDate > maxDate) {
        return res.status(400).json({ message: 'Solo se puede reservar con un máximo de 2 semanas de antelación.' });
    }

    const spotResult = await db.query('SELECT name FROM spots WHERE id = $1', [spotId]);
    if (spotResult.rows.length === 0) {
        return res.status(404).json({ message: 'El espacio de estacionamiento no existe.' });
    }
    const spotName = spotResult.rows[0].name;

    if ((requestDate.getDay() === 0 || requestDate.getDay() === 6) && spotName.startsWith('RADISON')) {
        return res.status(400).json({ message: 'Los espacios RADISON no se pueden reservar durante el fin de semana.' });
    }

    const holiday = await isHoliday(requestDate);
    if (holiday) {
        return res.status(400).json({ message: 'No se admiten reservas en días festivos.' });
    }

    if (new Date(`${date}T${startTime}`) >= new Date(`${date}T${endTime}`)) {
        return res.status(400).json({ message: 'La hora de inicio debe ser anterior a la hora de finalización.' });
    }

    const overlappingReservations = await db.query(
        `SELECT * FROM reservations WHERE spot_id = $1 AND date = $2 AND (start_time, end_time) OVERLAPS ($3::TIME, $4::TIME)`,
        [spotId, date, startTime, endTime]
    );

    if (overlappingReservations.rows.length > 0) {
        return res.status(409).json({ message: 'El espacio ya está reservado para el horario seleccionado.' });
    }

    const newReservationResult = await db.query(
        'INSERT INTO reservations (spot_id, user_id, date, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [spotId, userId, date, startTime, endTime]
    );
    const newReservation = { ...newReservationResult.rows[0], spotName, name, email };

    sendReservationConfirmationEmail(newReservation).catch(console.error);

    if ((requestDate.getDay() === 0 || requestDate.getDay() === 6) && config.coordinationEmail) {
        sendWeekendCoordinationEmail(newReservation, config.coordinationEmail).catch(console.error);
    }

    const gridState = await generateGridForDate(date);
    const myActiveReservations = await getMyActiveReservations(userId); // myActiveReservations is already the array
    res.status(201).json({ newReservation, gridState, gridDate: date, myReservations: myActiveReservations });

  } catch (error) {
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

// DELETE /api/reservations/admin/user/:email - ADMIN ONLY
router.delete('/admin/user/:email', authMiddleware, checkRole(['admin']), async (req, res) => {
    try {
        const { email } = req.params;
        const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const userId = userResult.rows[0].id;

        await db.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
        res.status(200).json({ message: `Todas las reservas para ${email} han sido eliminadas.` });
    } catch (error) {
        console.error(`[DELETE /api/reservations/admin/user/${req.params.email}] Failed:`, error);
        res.status(500).json({ message: 'Error al eliminar las reservas del usuario.' });
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

    sendReservationCancellationEmail(reservationToDelete).catch(err => {
        console.error(`[DELETE /api/reservations/${id}] Sending cancellation email failed:`, err);
    });

    const date = reservationToDelete.date;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const gridDate = `${year}-${month}-${day}`;
    const gridState = await generateGridForDate(gridDate);
    
    let myActiveReservations;
    if (role === 'admin') {
      myActiveReservations = await getAllAdminReservations();
    } else {
      myActiveReservations = await getMyActiveReservations(userId); // getMyActiveReservations returns the array directly
    }

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