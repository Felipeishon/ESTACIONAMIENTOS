const nodemailer = require('nodemailer');
const config = require('../config');

// 1. Crear un único "transportador" reutilizable para todos los correos.
let transporter;

// Solo se configura si las credenciales existen en la configuración.
if (config.email.host && config.email.user && config.email.pass) {
    transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure, // true for 465, false for other ports
        auth: {
            user: config.email.user,
            pass: config.email.pass,
        },
    });
} else {
    console.warn('[EmailService] El servicio de correo no está configurado. No se enviarán correos.');
}

/**
 * Función helper para enviar correos. Evita el envío si el transportador no está configurado
 * y maneja los errores de forma centralizada.
 * @param {object} mailOptions - Las opciones para nodemailer (from, to, subject, html).
 */
const sendMail = async (mailOptions) => {
    if (!transporter) {
        console.warn(`[EmailService] Omitiendo envío de correo a ${mailOptions.to} porque el servicio no está configurado.`);
        return;
    }
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        // No relanzamos el error para no detener el flujo principal de la aplicación (ej. una reserva es exitosa aunque falle el correo).
        console.error(`[EmailService] Error al enviar correo a ${mailOptions.to}:`, error);
    }
};

// --- Funciones de Correo Refactorizadas ---

const sendReservationConfirmationEmail = async (reservation) => {
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
                  <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.start_time} - ${reservation.end_time}</li>
                </ul>
              </div>
              <p>Si necesitas cancelar esta reserva, puedes hacerlo desde la sección "Mis Reservas" en la aplicación.</p>
              <p>Gracias por usar nuestro sistema.</p>
            </div>
          </div>
        `
    };
    await sendMail(mailOptions);
};

const sendReservationCancellationEmail = async (reservation) => {
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
                  <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.start_time} - ${reservation.end_time}</li>
                </ul>
              </div>
              <p>El espacio ahora está disponible para otros usuarios.</p>
              <p>Gracias por usar nuestro sistema.</p>
            </div>
          </div>
        `,
    };
    await sendMail(mailOptions);
};

const sendPasswordResetEmail = async (user, token) => {
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
    await sendMail(mailOptions);
};

const sendRegistrationConfirmationEmail = async (user) => {
    const mailOptions = {
        from: config.email.from,
        to: user.email,
        subject: '¡Bienvenido! Tu cuenta ha sido creada exitosamente',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h1 style="color: #007bff; font-size: 24px;">¡Bienvenido, ${user.name}!</h1>
              <p>Tu cuenta en el Sistema de Reservas de Estacionamiento ha sido creada con éxito.</p>
              <p>A continuación, te mostramos los datos que registraste:</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Tus Datos</h3>
                <ul style="list-style-type: none; padding: 0;">
                  <li style="margin-bottom: 10px;"><strong>Nombre:</strong> ${user.name}</li>
                  <li style="margin-bottom: 10px;"><strong>Email:</strong> ${user.email}</li>
                  <li style="margin-bottom: 10px;"><strong>RUT:</strong> ${user.rut || 'No ingresado'}</li>
                  <li style="margin-bottom: 10px;"><strong>Patente:</strong> ${user.license_plate || 'No ingresada'}</li>
                  <li style="margin-bottom: 10px;"><strong>Teléfono:</strong> ${user.phone_number || 'No ingresado'}</li>
                </ul>
              </div>
              <p style="font-size: 0.9em; color: #666;"><strong>Importante:</strong> Si alguno de estos datos es incorrecto (excepto la contraseña), por favor, contacta a la mesa de ayuda para solicitar la actualización.</p>
              <p>¡Ya puedes iniciar sesión y comenzar a reservar!</p>
            </div>
          </div>
        `
    };
    await sendMail(mailOptions);
};

const sendWeekendCoordinationEmail = async (reservation, coordinationEmail) => {
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
                  <li style="margin-bottom: 10px;"><strong>Fecha:</strong> ${reservation.date}</li>
                  <li style="margin-bottom: 10px;"><strong>Horario:</strong> ${reservation.start_time} - ${reservation.end_time}</li>
                </ul>
              </div>
              <p>Este es un correo de notificación para la coordinación de fin de semana.</p>
            </div>
          </div>
        `,
    };
    await sendMail(mailOptions);
};

module.exports = {
    sendReservationConfirmationEmail,
    sendReservationCancellationEmail,
    sendPasswordResetEmail,
    sendRegistrationConfirmationEmail,
    sendWeekendCoordinationEmail,
};