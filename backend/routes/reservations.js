const router = require('express').Router();
const config = require('../config');
const db = require('../utils/db');
const { generateGridForDate } = require('../services/parkingService');
const { getMyActiveReservations, validateAndCreateReservation } = require('../services/reservationService');
const {
    sendReservationConfirmationEmail,
    sendReservationCancellationEmail,
    sendWeekendCoordinationEmail,
} = require('../email/emailService');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');
const { asyncWrapper } = require('../utils');

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
router.get('/', authMiddleware, asyncWrapper(async (req, res) => {
    let reservations;
    if (req.user.role === 'admin') {
        reservations = await getAllAdminReservations();
    } else {
        reservations = await getMyActiveReservations(req.user.id);
    }
    res.json(reservations);
}));

// POST /api/reservations
router.post('/', authMiddleware, asyncWrapper(async (req, res) => {
    const { newReservation, requestDate } = await validateAndCreateReservation(req.body, req.user);

    // El objeto 'newReservation' ya tiene la fecha en el formato correcto (YYYY-MM-DD).
    // Se envían los correos de forma asíncrona para no bloquear la respuesta al usuario.
    sendReservationConfirmationEmail(newReservation).catch(console.error);

    if ((requestDate.getDay() === 0 || requestDate.getDay() === 6) && config.coordinationEmail) {
        sendWeekendCoordinationEmail(newReservation, config.coordinationEmail).catch(console.error);
    }

    // Se genera el estado actualizado de la grilla para la fecha de la reserva.
    const gridState = await generateGridForDate(newReservation.date);
    
    res.status(201).json({ message: 'Reserva creada con éxito', gridState });
}));

// DELETE /api/reservations/admin/all - ADMIN ONLY
router.delete('/admin/all', authMiddleware, checkRole(['admin']), asyncWrapper(async (req, res) => {
    await db.query('TRUNCATE TABLE reservations RESTART IDENTITY');
    res.status(200).json({ message: 'Todas las reservas han sido eliminadas.' });
}));

// DELETE /api/reservations/:id - User or Admin
router.delete('/:id', authMiddleware, asyncWrapper(async (req, res) => {
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
}));

module.exports = router;