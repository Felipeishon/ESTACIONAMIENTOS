const router = require('express').Router();
const config = require('../config');
const { randomUUID } = require('crypto');
const {
    readReservations,
    writeReservations,
    isTimeOverlap,
    isHoliday,
    acquireLock,
    releaseLock,
    generateGridForDate,
    getMyActiveReservations,
    sendReservationConfirmationEmail,
    sendReservationCancellationEmail,
} = require('../utils');
const { authMiddleware, checkRole } = require('../middleware/authMiddleware');

const NUMBER_OF_SPOTS = config.numberOfSpots;
const SPOT_NAMES = config.spotNames;

// GET /api/reservations
router.get('/', authMiddleware, async (req, res) => {
  try {
    const reservations = await readReservations();
    res.json(reservations);
  } catch (error) {
    console.error('[GET /api/reservations] Failed to get reservations:', error);
    res.status(500).json({ message: 'Error al recuperar las reservas de la base de datos.' });
  }
});

// POST /api/reservations
router.post('/', authMiddleware, async (req, res) => {
  await acquireLock();
  try {
    const { spotId, date, startTime, endTime } = req.body;
    const { email, name } = req.user; // Get user info from token

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

    if (requestDate.getDay() === 0 || requestDate.getDay() === 6) {
        return res.status(400).json({ message: 'No se admiten reservas en fin de semana.' });
    }

    const holiday = await isHoliday(requestDate);
    if (holiday) {
        return res.status(400).json({ message: 'No se admiten reservas en días festivos.' });
    }

    const newStart = new Date(`${date}T${startTime}`);
    const newEnd = new Date(`${date}T${endTime}`);

    if (newStart >= newEnd) {
        return res.status(400).json({ message: 'La hora de inicio debe ser anterior a la hora de finalización.' });
    }

    const reservations = await readReservations();
    const spotReservations = reservations.filter(r => r.spotId === spotId && r.date === date);

    for (const existing of spotReservations) {
        const existingStart = new Date(`${existing.date}T${existing.startTime}`);
        const existingEnd = new Date(`${existing.date}T${existing.endTime}`);
        if (isTimeOverlap(newStart, newEnd, existingStart, existingEnd)) {
            return res.status(409).json({ message: 'El espacio ya está reservado para el horario seleccionado.' });
        }
    }

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
router.delete('/admin/all', authMiddleware, checkRole(['admin']), async (req, res) => {
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
router.delete('/:id', authMiddleware, async (req, res) => {
  await acquireLock();
  try {
    const { id } = req.params;
    const { email, role } = req.user;

    const reservations = await readReservations();
    const reservationIndex = reservations.findIndex(r => r.id === id);

    if (reservationIndex === -1) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    const reservationToDelete = reservations[reservationIndex];
    
    if (role !== 'admin' && email !== reservationToDelete.email) {
      return res.status(403).json({ message: 'No tiene permiso para eliminar esta reserva.' });
    }

    reservations.splice(reservationIndex, 1);
    await writeReservations(reservations);

    sendReservationCancellationEmail(reservationToDelete).catch(err => {
        console.error(`[DELETE /api/reservations/${id}] Sending cancellation email failed:`, err);
    });

    const gridDate = reservationToDelete.date;
    const gridState = await generateGridForDate(gridDate, reservations);
    const myActiveReservations = getMyActiveReservations(reservations, reservationToDelete.email);

    res.status(200).json({
      message: 'Reserva eliminada con éxito',
      gridState,
      gridDate,
      myActiveReservations: myActiveReservations,
    });
  } catch (error) {
    console.error(`[DELETE /api/reservations/${req.params.id}] Failed:`, error);
    res.status(500).json({ message: 'Error al eliminar la reserva.' });
  } finally {
    releaseLock();
  }
});

module.exports = router;