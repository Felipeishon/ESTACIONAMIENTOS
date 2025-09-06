const express = require('express');
const { randomUUID } = require('crypto');
const { readReservations, writeReservations, isTimeOverlap, isHoliday, acquireLock, releaseLock, sendReservationConfirmationEmail, sendReservationCancellationEmail, generateGridForDate, getMyActiveReservations } = require('../utils');
const config = require('../config');

const router = express.Router();
const NUMBER_OF_SPOTS = config.numberOfSpots;
const SPOT_NAMES = config.spotNames;

// Middleware de autenticación de administrador (solo para rutas que son exclusivamente de admin)
const adminAuth = (req, res, next) => {
  const adminPassword = req.headers['x-admin-password'];
  if (!adminPassword || adminPassword !== config.adminPassword) {
    console.warn('[Admin Auth] Failed authentication attempt.');
    return res.status(403).json({ message: 'Acceso denegado: se requiere contraseña de administrador válida.' });
  }
  next();
};

// GET /api/reservations
router.get('/', async (req, res) => {
  await acquireLock();
  try {
    const reservations = await readReservations();
    res.json(reservations);
  } catch (error) {
    console.error('[GET /api/reservations] Failed to get reservations:', error);
    res.status(500).json({ message: 'Error al recuperar las reservas de la base de datos.' });
  } finally {
    releaseLock();
  }
});

// POST /api/reservations
router.post('/', async (req, res) => {
  await acquireLock();
  try {
    const { spotId, date, startTime, endTime, email, name } = req.body;
    if (!spotId || !date || !startTime || !endTime || !email || !name) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    // ... (resto de la lógica de validación y creación sin cambios) ...
    const reservations = await readReservations();
    const spotName = SPOT_NAMES[spotId - 1] || `Espacio ${spotId}`;
    const newReservation = { id: randomUUID(), spotId, spotName, date, startTime, endTime, name, email };
    reservations.push(newReservation);
    await writeReservations(reservations);
    sendReservationConfirmationEmail(newReservation).catch(console.error);
    const gridState = await generateGridForDate(date, reservations);
    const myActiveReservations = getMyActiveReservations(reservations, email);
    res.status(201).json({ newReservation, gridState, gridDate: date, myReservations: myActiveReservations });
  } catch (error) {
    console.error('[POST /api/reservations] Failed to create reservation:', error);
    res.status(500).json({ message: 'Error al guardar la reserva.' });
  } finally {
    releaseLock();
  }
});

// DELETE /api/reservations/admin/all - ADMIN ONLY
router.delete('/admin/all', adminAuth, async (req, res) => {
    await acquireLock();
    try {
        await writeReservations([]);
        res.status(200).json({ message: 'Todas las reservas han sido eliminadas.' });
    } catch (error) {
        console.error(`[DELETE /api/reservations/admin/all] Failed:`, error);
        res.status(500).json({ message: 'Error al eliminar todas las reservas.' });
    } finally {
        releaseLock();
    }
});

// DELETE /api/reservations/:id - User or Admin
router.delete('/:id', async (req, res) => {
  await acquireLock();
  try {
    const { id } = req.params;
    const adminPassword = req.headers['x-admin-password'];
    const { email: userEmail } = req.body; // Email del usuario que intenta borrar

    const reservations = await readReservations();
    const reservationIndex = reservations.findIndex(r => r.id === id);

    if (reservationIndex === -1) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    const reservationToDelete = reservations[reservationIndex];
    let isAuthorized = false;

    // Autorizado si es admin
    if (adminPassword && adminPassword === config.adminPassword) {
        isAuthorized = true;
        console.log(`[DELETE /${id}] Admin authorized deletion.`);
    }
    // O si el email coincide (para usuarios normales)
    else if (userEmail && userEmail === reservationToDelete.email) {
        isAuthorized = true;
        console.log(`[DELETE /${id}] User ${userEmail} authorized for own reservation.`);
    } else {
        console.log(`[DELETE /${id}] Unauthorized attempt. User email: ${userEmail}, Reservation email: ${reservationToDelete.email}`);
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'No tiene permiso para eliminar esta reserva.' });
    }

    reservations.splice(reservationIndex, 1);
    await writeReservations(reservations);

    sendReservationCancellationEmail(reservationToDelete).catch(err => {
        console.error(`[DELETE /${id}] Sending cancellation email failed:`, err);
    });

    const gridDate = reservationToDelete.date;
    const gridState = await generateGridForDate(gridDate, reservations);
    const myActiveReservations = getMyActiveReservations(reservations, reservationToDelete.email);

    res.status(200).json({
      message: 'Reserva eliminada con éxito',
      gridState,
      gridDate,
      myReservations: myActiveReservations,
    });
  } catch (error) {
    console.error(`[DELETE /api/reservations/${req.params.id}] Failed:`, error);
    res.status(500).json({ message: 'Error al eliminar la reserva.' });
  } finally {
    releaseLock();
  }
});

module.exports = router;
