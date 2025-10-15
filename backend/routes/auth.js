const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../utils/db');
const { sendPasswordResetEmail } = require('../utils');
const config = require('../config');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const isUserEmail = email.endsWith('@iansa.cl');
    const isAdminEmail = email === config.adminEmail;

    if (!isUserEmail && !isAdminEmail) {
      return res.status(403).json({ message: 'El registro solo está permitido para correos @iansa.cl o para el correo de administrador.' });
    }

    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === config.adminEmail ? 'admin' : 'user';

    const newUser = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, role]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('[POST /api/auth/register] Failed to register user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('[POST /api/auth/login] Failed to login:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetExpires = Date.now() + 3600000; // 1 hour from now

      await db.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [hashedToken, resetExpires, user.id]
      );
      
      await sendPasswordResetEmail({ email: user.email, name: user.name }, resetToken);
    }

    res.status(200).json({ message: 'Si tu correo electrónico está en nuestros registros, recibirás un enlace para restablecer tu contraseña.' });
  } catch (error) {
    console.error('[POST /api/auth/forgot-password] Error:', error);
    res.status(500).json({ message: 'Error sending password reset email.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'El token y la nueva contraseña son requeridos.' });
    }

    const result = await db.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > $2',
      // El token que llega del cliente es el original, debemos hashearlo para compararlo con el de la BD
      [crypto.createHash('sha256').update(token).digest('hex'), Date.now()]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'El token para restablecer la contraseña es inválido o ha expirado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.status(200).json({ message: 'Tu contraseña ha sido restablecida exitosamente.' });
  } catch (error) {
    console.error('[POST /api/auth/reset-password] Error:', error);
    res.status(500).json({ message: 'Ocurrió un error al restablecer la contraseña.' });
  }
});

module.exports = router;