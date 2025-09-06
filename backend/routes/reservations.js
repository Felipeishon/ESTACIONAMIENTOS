const express = require('express');
const { randomUUID } = require('crypto');
const { readReservations, writeReservations, isTimeOverlap, isHoliday, acquireLock, releaseLock, sendReservationConfirmationEmail, sendReservationCancellationEmail, generateGridForDate, getMyActiveReservations } = require('../utils');
const config = require('../config');

const router = express.Router();
const NUMBER_OF_SPOTS = config.numberOfSpots;
const SPOT_NAMES = config.spotNames;

// GET /api/reservations
router.get('/', async (req, res) => {
  await acquireLock();
  try {
    console.log(`[GET /api/reservations] Request received`);
    const reservations = await readReservations();
    console.log(`[GET /api/reservations] Retrieved ${reservations.length} reservations`);
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
  await acquireLock(); // Adquirir el bloqueo al inicio de la operación
  try {
    const { spotId, date, startTime, endTime, email, name } = req.body;

    console.log(`[POST /api/reservations] Request received: ${JSON.stringify({ spotId, date, startTime, endTime, email, name })}`);

    if (!spotId || !date || !startTime || !endTime || !email || !name) {
      console.log(`[POST /api/reservations] Missing required fields`);
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const trimmedName = name.trim();
    const nameParts = trimmedName.split(' ').filter(part => part.length > 0);

    if (typeof name !== 'string' || trimmedName.length < 5 || trimmedName.length > 50 || nameParts.length < 2) {
        console.log(`[POST /api/reservations] Invalid name format: ${name}`);
        return res.status(400).json({ message: 'Por favor, ingrese un nombre y apellido válidos (mínimo 2 palabras, entre 5 y 50 caracteres).' });
    }

    if (!email.endsWith(config.allowedEmailDomain)) {
      console.log(`[POST /api/reservations] Invalid email domain: ${email}`);
      return res.status(400).json({ message: `Dominio de correo electrónico inválido. Solo se permite ${config.allowedEmailDomain}.` });
    }

    if (typeof spotId !== 'number' || spotId < 1 || spotId > NUMBER_OF_SPOTS) {
      console.log(`[POST /api/reservations] Invalid spotId: ${spotId}`);
      return res.status(400).json({ message: `ID de espacio inválido. Debe ser un número entre 1 y ${NUMBER_OF_SPOTS}.` });
    }

    const newStart = new Date(`${date}T${startTime}`);
    const newEnd = new Date(`${date}T${endTime}`);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      console.log(`[POST /api/reservations] Invalid date/time format: ${date} ${startTime}-${endTime}`);
      return res.status(400).json({ message: 'Formato de fecha u hora inválido. Use AAAA-MM-DD y HH:MM.' });
    }

    const now = new Date();
    if (newStart < now) {
        console.log(`[POST /api/reservations] Attempted to book in the past: ${newStart}`);
        return res.status(400).json({ message: 'No se pueden hacer reservas para horarios que ya han pasado.' });
    }

    // --- New Validations ---
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const twoWeeksFromNow = new Date(now);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    twoWeeksFromNow.setHours(23, 59, 59, 999); // Set to the end of the 14th day

    // Use a timezone-safe way to parse the date string to avoid off-by-one day errors.
    // By appending T00:00:00, we ensure it's parsed as local time midnight.
    const reservationDate = new Date(`${date}T00:00:00`);

    if (reservationDate < today || reservationDate > twoWeeksFromNow) {
      console.log(`[POST /api/reservations] Invalid date: ${date}. Must be between ${today.toISOString()} and ${twoWeeksFromNow.toISOString()}`);
      return res.status(400).json({ message: 'Las reservas solo se pueden hacer para hoy y hasta 14 días en el futuro.' });
    }

    const dayOfWeek = reservationDate.getDay();
    if (dayOfWeek === 6 || dayOfWeek === 0) { // Saturday or Sunday
        console.log(`[POST /api/reservations] Attempted reservation on a weekend: ${date}`);
        return res.status(400).json({ message: 'Las reservas solo se pueden hacer en días hábiles.' });
    }

    const holiday = await isHoliday(reservationDate);
    if (holiday) {
        console.log(`[POST /api/reservations] Attempted reservation on a holiday: ${date}`);
        return res.status(400).json({ message: 'No se pueden hacer reservas en días festivos.' });
    }

    // Validate that times are in 30-minute intervals
    const startMinutes = newStart.getMinutes();
    const endMinutes = newEnd.getMinutes();
    if (startMinutes % 30 !== 0 || endMinutes % 30 !== 0) {
        console.log(`[POST /api/reservations] Invalid time interval: ${startTime} - ${endTime}`);
        return res.status(400).json({ message: 'Los horarios de reserva deben ser en intervalos de 30 minutos (ej. 09:00, 09:30).' });
    }
    // --- End of New Validations ---


    if (newStart >= newEnd) {
      console.log(`[POST /api/reservations] Invalid time range: ${startTime} >= ${endTime}`);
      return res.status(400).json({ message: 'La hora de salida debe ser posterior a la hora de entrada' });
    }

    const reservations = await readReservations();
    const isAlreadyReserved = reservations.some(r => {
      if (r.spotId !== spotId || r.date !== date) {
        return false;
      }
      const existingStart = new Date(`${r.date}T${r.startTime}`);
      const existingEnd = new Date(`${r.date}T${r.endTime}`);
      return isTimeOverlap(newStart, newEnd, existingStart, existingEnd);
    });

    if (isAlreadyReserved) {
      console.log(`[POST /api/reservations] Spot ${spotId} already reserved for ${date} ${startTime}-${endTime}`);
      return res.status(409).json({ message: 'El espacio de estacionamiento ya está reservado para esta fecha y hora' });
    }

    // Get spot name
    const spotName = SPOT_NAMES[spotId - 1] || `Espacio ${spotId}`;

    const newReservation = {
      id: randomUUID(),
      spotId,
      spotName,
      date,
      startTime,
      endTime,
      name,
      email,
    };

    reservations.push(newReservation);
    await writeReservations(reservations);

    // Send confirmation email in the background.
    // We don't `await` this, so the user gets a fast response.
    // A failure to send the email will be logged but won't fail the reservation request.
    sendReservationConfirmationEmail(newReservation).catch(err => {
        console.error('[POST /api/reservations] Sending confirmation email failed, but reservation was created:', err);
    });

    // --- New: Return the complete updated state to the client ---
    // Return the grid for the date of the new reservation
    const gridDate = date;
    const gridState = await generateGridForDate(gridDate, reservations);
    const myActiveReservations = getMyActiveReservations(reservations, email);

    console.log(`[POST /api/reservations] Reservation created successfully: ${newReservation.id} for email ${email}`);
    res.status(201).json({
      newReservation,
      gridState,
      gridDate,
      myReservations: myActiveReservations,
    });
  } catch (error) {
    console.error('[POST /api/reservations] Failed to create reservation:', error);
    res.status(500).json({ message: 'Error al guardar la reserva en la base de datos.' });
  } finally {
    releaseLock(); // Liberar el bloqueo siempre, incluso si hay un error
  }
});

// DELETE /api/reservations/:id
router.delete('/:id', async (req, res) => {
  await acquireLock();
  try {
    const { id } = req.params;
    console.log(`[DELETE /api/reservations/${id}] Request received`);

    const reservations = await readReservations();
    const reservationIndex = reservations.findIndex(r => r.id === id);

    if (reservationIndex === -1) {
      console.log(`[DELETE /api/reservations/${id}] Reservation not found`);
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    const reservationToDelete = reservations[reservationIndex];
    reservations.splice(reservationIndex, 1);
    await writeReservations(reservations);

    // Send cancellation email in the background
    sendReservationCancellationEmail(reservationToDelete).catch(err => {
        console.error(`[DELETE /api/reservations/${id}] Sending cancellation email failed, but reservation was deleted:`, err);
    });

    // --- New: Return the complete updated state to the client ---
    // Return the grid for the date of the deleted reservation
    const gridDate = reservationToDelete.date;
    const gridState = await generateGridForDate(gridDate, reservations);
    const myActiveReservations = getMyActiveReservations(reservations, reservationToDelete.email);

    console.log(`[DELETE /api/reservations/${id}] Reservation deleted successfully`);
    // Return 200 with a payload instead of 204 No Content
    res.status(200).json({
      gridState,
      gridDate,
      myReservations: myActiveReservations,
    });
  } catch (error) {
    console.error(`[DELETE /api/reservations/${req.params.id}] Failed to delete reservation:`, error);
    res.status(500).json({ message: 'Error al eliminar la reserva de la base de datos.' });
  } finally {
    releaseLock();
  }
});

module.exports = router;
