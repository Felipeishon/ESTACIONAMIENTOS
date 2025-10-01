const https = require('https');
const nodemailer = require('nodemailer');
const config = require('./config');
const db = require('./utils/db');

// Helper function to check for time overlap (can be kept for client-side or non-db logic)
const isTimeOverlap = (newStart, newEnd, existingStart, existingEnd) => {
  return newStart < existingEnd && newEnd > existingStart;
};

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

const generateGridForDate = async (date) => {
  const requestDate = new Date(`${date}T00:00:00`);
  if (isNaN(requestDate.getTime())) {
    throw new Error('Invalid date format provided to generateGridForDate.');
  }

  // 1. Get all spots from the database
  const spotsResult = await db.query('SELECT id, name FROM spots ORDER BY id');
  const allSpots = spotsResult.rows;

  // 2. Get all reservations for the given date
  const reservationsResult = await db.query(
    `SELECT r.spot_id, r.start_time, r.end_time, u.name as user_name
     FROM reservations r
     JOIN users u ON r.user_id = u.id
     WHERE r.date = $1`,
    [date]
  );
  const reservationsForDate = reservationsResult.rows;

  // 3. Create the initial grid with all slots free
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

  // 4. Create a lookup map for faster access
  const spotsMap = new Map(grid.map(spot => [spot.id, spot]));

  // 5. "Paint" reservations onto the grid
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

// --- Email Functions (Full implementation should be kept) ---

const sendReservationConfirmationEmail = async (reservation) => {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    console.warn('[sendReservationConfirmationEmail] Email service is not configured. Skipping email notification.');
    return;
  }
  const transporter = nodemailer.createTransport({ host: config.email.host, port: config.email.port, secure: config.email.secure, auth: { user: config.email.user, pass: config.email.pass } });
  const mailOptions = {
    from: config.email.from,
    to: reservation.email,
    subject: 'Confirmación de Reserva de Estacionamiento',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h1 style="color: #007bff; font-size: 24px;">¡Reserva Confirmada!</h1>
          <p>Hola ${reservation.name},</p>
          <p>Tu reserva de estacionamiento ha sido confirmada exitosamente. A continuación, los detalles:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Detalles de la Reserva</h3>
            <ul style="list-style-type: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Estacionamiento:</strong> ${reservation.spotName}</li>
              <li style="margin-bottom: 10px;"><strong>Fecha:</strong> ${new Date(reservation.date).toLocaleDateString('es-CL')}</li>
              <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.start_time} - ${reservation.end_time}</li>
            </ul>
          </div>
          <p>Si necesitas cancelar esta reserva, puedes hacerlo desde la sección "Mis Reservas" en la aplicación.</p>
          <p>Gracias por usar nuestro sistema.</p>
        </div>
      </div>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`[sendReservationConfirmationEmail] Error sending email to ${reservation.email}:`, error);
  }
};

const sendReservationCancellationEmail = async (reservation) => {
    if (!config.email.host || !config.email.user || !config.email.pass) {
    console.warn('[sendReservationCancellationEmail] Email service is not configured. Skipping email notification.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  const mailOptions = {
    from: config.email.from,
    to: reservation.email,
    subject: 'Cancelación de Reserva de Estacionamiento',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h1 style="color: #dc3545; font-size: 24px;">Reserva Cancelada</h1>
          <p>Hola ${reservation.name},</p>
          <p>Te confirmamos que tu reserva de estacionamiento ha sido cancelada. Los detalles de la reserva cancelada eran:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <ul style="list-style-type: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Estacionamiento:</strong> ${reservation.spotName}</li>
              <li style="margin-bottom: 10px;"><strong>Fecha:</strong> ${new Date(reservation.date).toLocaleDateString('es-CL')}</li>
              <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.start_time} - ${reservation.end_time}</li>
            </ul>
          </div>
          <p>El espacio ahora está disponible para otros usuarios.</p>
          <p>Gracias por usar nuestro sistema.</p>
        </div>
      </div>
    `,
  };

  try {
    console.log(`[sendReservationCancellationEmail] Sending mail to ${reservation.email}...`);
    await transporter.sendMail(mailOptions);
    console.log(`[sendReservationCancellationEmail] Email sent successfully to ${reservation.email}`);
  } catch (error) {
    console.error(`[sendReservationCancellationEmail] Error sending email to ${reservation.email}:`, error);
  }
};

const sendPasswordResetEmail = async (user, token) => {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    const errorMsg = '[sendPasswordResetEmail] Email service is not configured. Skipping email notification.';
    console.error(errorMsg);
    throw new Error(errorMsg); // Lanzar un error para que el catch lo capture
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  // The reset URL the user will click
  const resetUrl = `${config.frontendUrl}/#reset-password?token=${token}`;

  const mailOptions = {
    from: config.email.from,
    to: user.email,
    subject: 'Restablecimiento de Contraseña para tu Cuenta',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h1 style="color: #007bff; font-size: 24px;">Solicitud de Restablecimiento de Contraseña</h1>
          <p>Hola ${user.name},</p>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si no hiciste esta solicitud, puedes ignorar este correo electrónico de forma segura.</p>
          <p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px;">Restablecer Contraseña</a>
          </p>
          <p>Este enlace de restablecimiento de contraseña caducará en 1 hora.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(`[sendPasswordResetEmail] Error sending password reset email to ${user.email}:`, error);
  }
};

const sendWeekendCoordinationEmail = async (reservation, coordinationEmail) => {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    console.warn('[sendWeekendCoordinationEmail] Email service is not configured. Skipping email notification.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  const mailOptions = {
    from: config.email.from,
    to: coordinationEmail,
    subject: 'Validación de Reserva de Fin de Semana',
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h1 style="color: #007bff; font-size: 24px;">Validación de Reserva de Fin de Semana</h1>
          <p>Se ha realizado una nueva reserva para el fin de semana. A continuación, los detalles:</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Detalles de la Reserva</h3>
            <ul style="list-style-type: none; padding: 0;">
              <li style="margin-bottom: 10px;"><strong>Usuario:</strong> ${reservation.name} (${reservation.email})</li>
              <li style="margin-bottom: 10px;"><strong>Estacionamiento:</strong> ${reservation.spotName}</li>
              <li style="margin-bottom: 10px;"><strong>Fecha:</strong> ${new Date(reservation.date).toLocaleDateString('es-CL')}</li>
              <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.start_time} - ${reservation.end_time}</li>
            </ul>
          </div>
          <p>Este es un correo de notificación para la coordinación de fin de semana.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[sendWeekendCoordinationEmail] Weekend coordination email sent to ${coordinationEmail}`);
  } catch (error) {
    console.error(`[sendWeekendCoordinationEmail] Error sending email to ${coordinationEmail}:`, error);
  }
};

module.exports = {
  isTimeOverlap,
  isHoliday,
  generateGridForDate,
  getMyActiveReservations,
  sendReservationConfirmationEmail,
  sendReservationCancellationEmail,
  sendPasswordResetEmail,
  sendWeekendCoordinationEmail,
};