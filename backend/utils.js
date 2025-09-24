const { promises: fs } = require('fs');
const path = require('path');
const https = require('https');
const nodemailer = require('nodemailer');
const config = require('./config');

const dbPath = path.join(__dirname, 'db.json');
const usersPath = path.join(__dirname, 'users.json');


// A more robust queue-based semaphore to prevent race conditions on file access.
let isLockBusy = false;
const lockQueue = [];

const acquireLock = async () => {
  return new Promise((resolve) => {
    // If the lock is not busy, acquire it immediately and resolve.
    if (!isLockBusy) {
      isLockBusy = true;
      resolve();
    } else {
      // Otherwise, add the resolver to the queue to be called later.
      lockQueue.push(resolve);
    }
  });
};

const releaseLock = () => {
  // If there are pending operations, grant the lock to the next in queue.
  if (lockQueue.length > 0) {
    const nextInQueue = lockQueue.shift();
    nextInQueue(); // This resolves the promise, allowing the next operation to proceed.
  } else {
    // If the queue is empty, the lock is no longer busy.
    isLockBusy = false;
  }
};

// Helper function to read from db.json
const readReservations = async () => {
  try {
    const dbData = await fs.readFile(dbPath, 'utf8');
    // Handle empty file gracefully
    if (!dbData.trim()) {
      return [];
    }
    const parsedData = JSON.parse(dbData);
    // Ensure the 'reservations' property is an array
    return Array.isArray(parsedData.reservations) ? parsedData.reservations : [];
  } catch (error) {
    // If the file doesn't exist or is empty, it's not an error, just start fresh.
    if (error.code === 'ENOENT') {
      return [];
    }
    // If it's a JSON parsing error, log it and return empty to prevent a crash.
    if (error instanceof SyntaxError) {
      console.error(`[readReservations] Error parsing db.json: ${error.message}. Returning empty array.`);
      return [];
    }
    // For other unexpected errors, re-throw to be handled by the route handler.
    throw error;
  }
};

// Helper function to write to db.json with concurrency control
const writeReservations = async (reservations) => {
  await fs.writeFile(dbPath, JSON.stringify({ reservations }, null, 2), 'utf8');
};

// Helper function to read from users.json
const readUsers = async () => {
  try {
    const usersData = await fs.readFile(usersPath, 'utf8');
    // Handle empty file gracefully
    if (!usersData.trim()) {
      return [];
    }
    const parsedData = JSON.parse(usersData);
    // Ensure the 'users' property is an array
    return Array.isArray(parsedData.users) ? parsedData.users : [];
  } catch (error) {
    // If the file doesn't exist or is empty, it's not an error, just start fresh.
    if (error.code === 'ENOENT') {
      return [];
    }
    // If it's a JSON parsing error, log it and return empty to prevent a crash.
    if (error instanceof SyntaxError) {
      console.error(`[readUsers] Error parsing users.json: ${error.message}. Returning empty array.`);
      return [];
    }
    // For other unexpected errors, re-throw to be handled by the route handler.
    throw error;
  }
};

// Helper function to write to users.json with concurrency control
const writeUsers = async (users) => {
  await fs.writeFile(usersPath, JSON.stringify({ users }, null, 2), 'utf8');
};

// Helper function to check for time overlap
const isTimeOverlap = (newStart, newEnd, existingStart, existingEnd) => {
  // Parameters are expected to be Date objects
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
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const holidays = JSON.parse(data);
          resolve(holidays.length > 0);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

const generateGridForDate = async (date, reservationsArray = null) => {
  const allReservations = reservationsArray || await readReservations();
  const requestDate = new Date(`${date}T00:00:00`);
  if (isNaN(requestDate.getTime())) {
    throw new Error('Invalid date format provided to generateGridForDate.');
  }

  // 1. Create the initial grid with all slots free
  const spots = Array.from({ length: config.numberOfSpots }, (_, i) => {
    const spotId = i + 1;
    const spotName = config.spotNames[i] || `Espacio ${spotId}`;
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
    return { id: spotId, name: spotName, timeSlots };
  });

  // 2. Create a lookup map for faster access
  const spotsMap = new Map(spots.map(spot => [spot.id, spot]));

  // 3. Filter reservations for the given date and "paint" them onto the grid
  const reservationsForDate = allReservations.filter(r => r.date === date);

  for (const reservation of reservationsForDate) {
    // Defensive checks for malformed reservation objects
    if (!reservation || typeof reservation.spotId !== 'number' || !reservation.startTime || !reservation.endTime) {
      console.warn(`[generateGridForDate] Skipping malformed or incomplete reservation: ${JSON.stringify(reservation)}`);
      continue;
    }

    const spot = spotsMap.get(reservation.spotId);
    if (!spot) {
      console.warn(`[generateGridForDate] Skipping reservation for non-existent spotId: ${reservation.spotId}`);
      continue;
    }

    const [startHour, startMinute] = reservation.startTime.split(':').map(Number);
    const [endHour, endMinute] = reservation.endTime.split(':').map(Number);

    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
      console.warn(`[generateGridForDate] Skipping reservation with invalid time format: ${JSON.stringify(reservation)}`);
      continue;
    }

    const startIndex = startHour * 2 + (startMinute / 30);
    const endIndex = endHour * 2 + (endMinute / 30);

    for (let i = startIndex; i < endIndex; i++) {
      if (spot.timeSlots[i]) {
        spot.timeSlots[i].isReserved = true;
        spot.timeSlots[i].reservedBy = reservation.name || reservation.email || reservation.user;
      }
    }
  }

  console.log(`[generateGridForDate] Generated grid for ${date} with ${allReservations.length} total reservations.`);
  return spots;
};

const getMyActiveReservations = (allReservations, userEmail) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to the beginning of today to compare dates only

    const myReservations = allReservations.filter(r => {
        if (r.email !== userEmail) return false;
        // Timezone-safe parsing to avoid off-by-one day errors
        const reservationDate = new Date(`${r.date}T00:00:00`);
        return reservationDate >= today;
    });

    // Sort them for consistent display
    return myReservations.sort((a, b) => new Date(`${a.date}T${a.startTime}`) - new Date(`${b.date}T${b.startTime}`));
};

const sendReservationConfirmationEmail = async (reservation) => {
  // Check if email service is configured. If not, log a warning and exit.
  if (!config.email.host || !config.email.user || !config.email.pass) {
    console.warn('[sendReservationConfirmationEmail] Email service is not configured. Skipping email notification.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure, // true for 465, false for other ports
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

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
              <li style="margin-bottom: 10px;"><strong>Fecha:</strong> ${reservation.date}</li>
              <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.startTime} - ${reservation.endTime}</li>
            </ul>
          </div>
          <p>Si necesitas cancelar esta reserva, puedes hacerlo desde la sección "Mis Reservas" en la aplicación.</p>
          <p>Gracias por usar nuestro sistema.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">Este es un correo electrónico automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[sendReservationConfirmationEmail] Email sent successfully to ${reservation.email}: ${info.messageId}`);
  } catch (error) {
    console.error(`[sendReservationConfirmationEmail] Error sending email to ${reservation.email}:`, error);
    // We don't re-throw the error because the reservation itself was successful.
    // Email failure should not fail the main operation.
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
              <li style="margin-bottom: 10px;"><strong>Fecha:</strong> ${reservation.date}</li>
              <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.startTime} - ${reservation.endTime}</li>
            </ul>
          </div>
          <p>El espacio ahora está disponible para otros usuarios.</p>
          <p>Gracias por usar nuestro sistema.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[sendReservationCancellationEmail] Email sent successfully to ${reservation.email}: ${info.messageId}`);
  } catch (error) {
    console.error(`[sendReservationCancellationEmail] Error sending email to ${reservation.email}:`, error);
  }
};

const sendPasswordResetEmail = async (user, token) => {
  if (!config.email.host || !config.email.user || !config.email.pass) {
    console.warn('[sendPasswordResetEmail] Email service is not configured. Skipping email notification.');
    // In a real app, you might want to throw an error here if email is critical
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

  // The reset URL the user will click
  const resetUrl = `http://192.168.70.12:8000/#reset-password?token=${token}`;

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
          <p>Si tienes problemas para hacer clic en el botón, copia y pega la siguiente URL en tu navegador:</p>
          <p style="word-break: break-all; font-size: 12px;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888;">Este es un correo electrónico automático, por favor no respondas a este mensaje.</p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[sendPasswordResetEmail] Password reset email sent successfully to ${user.email}: ${info.messageId}`);
  } catch (error) {
    console.error(`[sendPasswordResetEmail] Error sending password reset email to ${user.email}:`, error);
    // Depending on the app's needs, you might want to throw an error to let the calling function know.
    // For now, we just log it.
  }
};

module.exports = {
  readReservations,
  writeReservations,
  readUsers,
  writeUsers,
  isTimeOverlap,
  isHoliday,
  acquireLock,
  releaseLock,
  generateGridForDate,
  getMyActiveReservations,
  sendReservationConfirmationEmail,
  sendReservationCancellationEmail,
  sendPasswordResetEmail,
};