const db = require('../utils/db');
const https = require('https');
const config = require('../config');

/**
 * Verifica si una fecha dada es un día festivo en Chile.
 * @param {Date} date - El objeto Date a verificar.
 * @returns {Promise<boolean>} - True si es festivo, false si no lo es.
 */
const isHoliday = (date) => {
    return new Promise((resolve, reject) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        const options = {
            hostname: 'api.api-ninjas.com',
            path: `/v1/holidays?country=CL&year=${year}&month=${month}&day=${day}`,
            headers: {
                'X-Api-Key': config.apiNinjasKey,
            },
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const holidays = JSON.parse(data);
                    resolve(holidays.length > 0);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (err) => reject(err));
    });
};

/**
 * Genera la grilla de disponibilidad de estacionamientos para una fecha específica.
 * @param {string} date - La fecha en formato YYYY-MM-DD.
 * @returns {Promise<Array>} - Un array que representa la grilla de estacionamientos y sus horarios.
 */
const generateGridForDate = async (date) => {
    const requestDate = new Date(`${date}T00:00:00`);
    if (isNaN(requestDate.getTime())) {
        throw new Error('Invalid date format provided to generateGridForDate.');
    }

    // 1. Obtener todos los estacionamientos de la base de datos.
    const spotsResult = await db.query('SELECT id, name FROM spots ORDER BY id');
    const allSpots = spotsResult.rows;

    // 2. Obtener todas las reservas para la fecha dada.
    const reservationsResult = await db.query(
        `SELECT r.spot_id, r.start_time, r.end_time, u.name as user_name
         FROM reservations r
         JOIN users u ON r.user_id = u.id
         WHERE r.date = $1`,
        [date]
    );
    const reservationsForDate = reservationsResult.rows;

    // 3. Crear la grilla inicial con todos los horarios libres.
    const grid = allSpots.map(spot => {
        const timeSlots = [];
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const slotStart = new Date(requestDate);
                slotStart.setHours(hour, minute, 0, 0);
                const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
                timeSlots.push({
                    startTime: slotStart.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                    endTime: slotEnd.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                    isReserved: false,
                    reservedBy: null,
                });
            }
        }
        return { id: spot.id, name: spot.name, timeSlots };
    });

    // 4. Crear un mapa para un acceso más rápido.
    const spotsMap = new Map(grid.map(spot => [spot.id, spot]));

    // 5. "Pintar" las reservas sobre la grilla.
    for (const reservation of reservationsForDate) {
        const spot = spotsMap.get(reservation.spot_id);
        if (!spot) continue;

        const [startHour, startMinute] = reservation.start_time.split(':').map(Number);
        const [endHour, endMinute] = reservation.end_time.split(':').map(Number);

        const startIndex = startHour * 2 + (startMinute / 30);
        const endIndex = endHour * 2 + (endMinute / 30);

        for (let i = startIndex; i < endIndex; i++) {
            if (spot.timeSlots[i]) {
                spot.timeSlots[i].isReserved = true;
                spot.timeSlots[i].reservedBy = reservation.user_name;
            }
        }
    }

    return grid;
};

module.exports = {
    isHoliday,
    generateGridForDate,
};