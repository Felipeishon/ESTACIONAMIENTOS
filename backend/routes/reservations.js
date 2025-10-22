const router = require('express').Router();
const config = require('../config');
const db = require('../utils/db');
const {
    generateGridForDate,
    getMyActiveReservations,
    sendReservationConfirmationEmail,
    sendReservationCancellationEmail,
    sendWeekendCoordinationEmail,
    validateAndCreateReservation,
} = require('../utils');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

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

router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const reservations = req.user.role === 'admin'
            ? await getAllAdminReservations()
            : await getMyActiveReservations(req.user.id);
        res.json(reservations);
    } catch (error) {
        next(error);
    }
});

router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { newReservation, requestDate } = await validateAndCreateReservation(req.body, req.user);
        const emailData = { ...newReservation, date: newReservation.date.split('T')[0] };

        sendReservationConfirmationEmail(emailData).catch(console.error);

        if ((requestDate.getDay() === 0 || requestDate.getDay() === 6) && config.coordinationEmail) {
            sendWeekendCoordinationEmail(newReservation, config.coordinationEmail).catch(console.error);
        }

        const gridState = await generateGridForDate(newReservation.date);
        const myActiveReservations = await getMyActiveReservations(req.user.id);
        res.status(201).json({
            message: 'Reserva creada con éxito',
            newReservation,
            gridState,
            gridDate: newReservation.date,
            myReservations: myActiveReservations,
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/admin/all', authMiddleware, checkRole(['admin']), async (req, res, next) => {
    try {
        await db.query('TRUNCATE TABLE reservations RESTART IDENTITY');
        res.status(200).json({ message: 'Todas las reservas han sido eliminadas.' });
    } catch (error) {
        next(error);
    }
});

router.delete('/admin/user/:email', authMiddleware, checkRole(['admin']), async (req, res, next) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const { email } = req.params;
        const userResult = await client.query('SELECT id, name FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const { id: userId, name } = userResult.rows[0];

        const reservationsToCancel = await client.query(`
            SELECT r.id, r.date, r.start_time, r.end_time, s.name as "spotName"
            FROM reservations r
            JOIN spots s ON r.spot_id = s.id
            WHERE r.user_id = $1
        `, [userId]);

        if (reservationsToCancel.rows.length > 0) {
            await client.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
        }

        await client.query('COMMIT');

        if (reservationsToCancel.rows.length > 0) {
            reservationsToCancel.rows.forEach(reservation => {
                const emailData = {
                    ...reservation,
                    email,
                    name,
                    date: new Date(reservation.date).toISOString().split('T')[0],
                };
                sendReservationCancellationEmail(emailData).catch(console.error);
            });
        }

        res.status(200).json({ message: `Todas las reservas para ${email} han sido eliminadas.` });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { id: userId, role } = req.user;

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
        const r = result.rows[0];

        if (role !== 'admin' && userId !== r.user_id) {
            return res.status(403).json({ message: 'No tiene permiso para eliminar esta reserva.' });
        }

        await db.query('DELETE FROM reservations WHERE id = $1', [id]);

        sendReservationCancellationEmail({
            ...r,
            date: new Date(r.date).toISOString().split('T')[0],
        }).catch(console.error);

        const gridDate = new Date(r.date).toISOString().split('T')[0];
        const gridState = await generateGridForDate(gridDate);
        const myActiveReservations = await getMyActiveReservations(userId);

        res.status(200).json({
            message: 'Reserva eliminada con éxito',
            gridState,
            gridDate,
            myReservations: myActiveReservations,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
