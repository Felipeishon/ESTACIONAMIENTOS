const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../utils/db');
const config = require('../config');
const { sendPasswordResetEmail, sendRegistrationConfirmationEmail } = require('../email/emailService');
const { asyncWrapper } = require('../utils');
const { validatePassword } = require('../utils/validators');
const { registerUserChecks, handleValidationErrors } = require('../middleware/validators');

// POST /api/auth/register
router.post('/register',
    registerUserChecks,       // 1. Ejecuta las validaciones y sanitizaciones
    handleValidationErrors,   // 2. Si hay errores, los maneja y detiene la ejecución
    asyncWrapper(async (req, res) => { // 3. Si todo está bien, procede con la lógica
        // El req.body ya ha sido validado y sanitizado por los middlewares.
        const { name, email, password, rut, license_plate, phone_number } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);
        const role = email === config.adminEmail ? 'admin' : 'user';

        await db.query(
            'INSERT INTO users (name, email, password, role, rut, license_plate, phone_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [name, email, hashedPassword, role, rut, license_plate, phone_number]
        );

        await sendRegistrationConfirmationEmail({ name, email, rut, license_plate, phone_number });

        res.status(201).json({ message: 'Usuario registrado exitosamente' });
    })
);

// POST /api/auth/login
router.post('/login', asyncWrapper(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'El correo y la contraseña son obligatorios.' });
  }

  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, rut: user.rut, license_plate: user.license_plate, phone_number: user.phone_number },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  res.json({ token });
}));

// POST /api/auth/forgot-password
router.post('/forgot-password', asyncWrapper(async (req, res) => {
  const { email } = req.body;
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = Date.now() + 3600000; // 1 hour

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [hashedToken, resetExpires, user.id]
    );
    
    await sendPasswordResetEmail({ email: user.email, name: user.name }, resetToken);
  }

  res.status(200).json({ message: 'Si tu correo electrónico está en nuestros registros, recibirás un enlace para restablecer tu contraseña.' });
}));

// POST /api/auth/reset-password
router.post('/reset-password', asyncWrapper(async (req, res) => {
  const { token, password } = req.body;
  const sanitizedPassword = validatePassword(password);
  if (!sanitizedPassword || !token) {
      return res.status(400).json({ message: 'El token y la nueva contraseña (que cumpla los requisitos) son requeridos.' });
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  const result = await db.query(
    'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > $2',
    [hashedToken, Date.now()]
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(400).json({ message: 'El token para restablecer la contraseña es inválido o ha expirado.' });
  }

  const hashedPassword = await bcrypt.hash(sanitizedPassword, 10);

  await db.query(
    'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
    [hashedPassword, user.id]
  );

  res.status(200).json({ message: 'Tu contraseña ha sido restablecida exitosamente.' });
}));

module.exports = router;