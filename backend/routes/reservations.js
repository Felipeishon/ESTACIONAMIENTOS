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

// DELETE /api/reservations/admin/user/:email - ADMIN ONLY
router.delete('/admin/user/:email', authMiddleware, checkRole(['admin']), async (req, res) => {
    try {
        const { email } = req.params;
        const userResult = await db.query('SELECT id, name FROM users WHERE email = $1', [email]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const { id: userId, name } = userResult.rows[0];

        // Step 1: Get all reservations for the user
        const reservationsToCancel = await db.query(`
            SELECT r.id, r.date, r.start_time, r.end_time, s.name as "spotName"
            FROM reservations r
            JOIN spots s ON r.spot_id = s.id
            WHERE r.user_id = $1
        `, [userId]);

        // Step 2: Delete the reservations from the database
        if (reservationsToCancel.rows.length > 0) {
            await db.query('DELETE FROM reservations WHERE user_id = $1', [userId]);
        }

        // Step 3: Now, send a cancellation email for each reservation that was fetched
        if (reservationsToCancel.rows.length > 0) {
            const emailPromises = reservationsToCancel.rows.map(reservation => {
                const emailData = {
                    ...reservation,
                    email, // Add user email
                    name,  // Add user name
                    date: new Date(reservation.date).toISOString().split('T')[0],
                };
                return sendReservationCancellationEmail(emailData);
            });
            Promise.allSettled(emailPromises).then(results => {
                results.forEach(result => {
                    if (result.status === 'rejected') {
                        console.error("Email sending failed after response was sent:", result.reason);
                    }
                });
            });
        }

        res.status(200).json({ message: `Todas las reservas para ${email} han sido eliminadas. Las notificaciones se están enviando.` });
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

module.exports = router;oDelete.date).toISOString().split('T')[0], // <-- CORRECCIÓN
        start_time: reservationToDelete.start_time,
        end_time: reservationToDelete.end_time,
    };
    sendReservationCancellationEmail(emailData).catch(err => {
        console.error(`[DELETE /api/reservations/${id}] Sending cancellation email failed:`, err);
    });

    // Asegurarse de que la fecha esté en formato YYYY-MM-DD para la grilla
    const gridDate = new Date(reservationToDelete.date).toISOString().split('T')[0];
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