const db = require('../utils/db');
const { isHoliday } = require('./parkingService');
const { createApiError } = require('../utils');

/**
 * Obtiene todas las reservas activas (fecha actual o futura) para un usuario específico.
 * @param {number} userId - El ID del usuario.
 * @returns {Promise<Array>} - Una lista de las reservas del usuario.
 */
const getMyActiveReservations = async (userId) => {
    const result = await db.query(
        `SELECT r.id, r.spot_id, s.name as "spotName", r.date, r.start_time, r.end_time, u.name, u.email
         FROM reservations r
         JOIN spots s ON r.spot_id = s.id
         JOIN users u ON r.user_id = u.id
         WHERE u.id = $1 AND r.date >= CURRENT_DATE
         ORDER BY r.date, r.start_time`,
        [userId]
    );
    return result.rows;
};

/**
 * Valida los datos de una nueva reserva y, si son correctos, la crea en la base de datos.
 * @param {object} body - El cuerpo de la solicitud con los datos de la reserva.
 * @param {object} user - El objeto de usuario que realiza la solicitud.
 * @returns {Promise<object>} - Un objeto con la nueva reserva y la fecha de la solicitud.
 */
const validateAndCreateReservation = async (body, user) => {
    const { spotId, date, startTime, endTime } = body;
    const { id: userId, email, name } = user;

    if (!spotId || !date || !startTime || !endTime) {
        throw createApiError('Faltan campos obligatorios', 400);
    }

    // Validación del nombre de usuario
    const nameRegex = /^[A-Za-z\s]+$/;
    if (typeof name !== 'string' || name.length < 2 || name.length > 50 || !nameRegex.test(name)) {
        throw createApiError('El nombre debe tener entre 2 y 50 caracteres y contener solo letras y espacios.', 400);
    }

    const requestDate = new Date(`${date}T00:00:00`);
    if (isNaN(requestDate.getTime())) {
        throw createApiError('Formato de fecha inválido.', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestDate < today) {
        throw createApiError('No se pueden hacer reservas para fechas pasadas.', 400);
    }

    const maxDate = new Date();
    maxDate.setHours(0, 0, 0, 0);
    maxDate.setDate(maxDate.getDate() + 14);
    if (requestDate > maxDate) {
        throw createApiError('Solo se puede reservar con un máximo de 2 semanas de antelación.', 400);
    }

    const spotResult = await db.query('SELECT name FROM spots WHERE id = $1', [spotId]);
    if (spotResult.rows.length === 0) {
        throw createApiError('El espacio de estacionamiento no existe.', 404);
    }
    const spotName = spotResult.rows[0].name;

    if ((requestDate.getDay() === 0 || requestDate.getDay() === 6) && spotName.startsWith('RADISON')) {
        throw createApiError('Los espacios RADISON no se pueden reservar durante el fin de semana.', 400);
    }

    const holiday = await isHoliday(requestDate);
    if (holiday) {
        throw createApiError('No se admiten reservas en días festivos.', 400);
    }

    if (new Date(`${date}T${startTime}`) >= new Date(`${date}T${endTime}`)) {
        throw createApiError('La hora de inicio debe ser anterior a la hora de finalización.', 400);
    }

    const overlappingReservations = await db.query(
        `SELECT 1 FROM reservations WHERE spot_id = $1 AND date = $2 AND (start_time, end_time) OVERLAPS ($3::TIME, $4::TIME) LIMIT 1`,
        [spotId, date, startTime, endTime]
    );

    if (overlappingReservations.rows.length > 0) {
        throw createApiError('El espacio ya está reservado para el horario seleccionado.', 409);
    }

    const newReservationResult = await db.query(
        'INSERT INTO reservations (spot_id, user_id, date, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [spotId, userId, date, startTime, endTime]
    );

    // Formatear la fecha para que sea consistente (YYYY-MM-DD)
    const reservationDate = new Date(newReservationResult.rows[0].date).toISOString().split('T')[0];

    const newReservation = { ...newReservationResult.rows[0], date: reservationDate, spotName, name, email };

    return { newReservation, requestDate };
};

module.exports = {
    getMyActiveReservations,
    validateAndCreateReservation,
};