const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const crypto = require('crypto');
const { readUsers, writeUsers, acquireLock, releaseLock, sendPasswordResetEmail } = require('../utils');
const config = require('../config');

const ADMIN_EMAIL = 'reservas.estacionamiento.iansa@gmail.com';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  await acquireLock();
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Allow registration only for @iansa.cl domain or the specific admin email
    if (!email.endsWith('@iansa.cl') && email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'El registro solo está permitido para correos con dominio @iansa.cl' });
    }

    const users = await readUsers();
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: randomUUID(),
      name,
      email,
      password: hashedPassword,
      role: email === ADMIN_EMAIL ? 'admin' : 'user',
    };

    users.push(newUser);
    await writeUsers(users);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('[POST /api/auth/register] Failed to register user:', error);
    res.status(500).json({ message: 'Error registering user' });
  } finally {
    releaseLock();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  await acquireLock();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const users = await readUsers();
    const user = users.find(u => u.email === email);
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
  } finally {
    releaseLock();
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  await acquireLock();
  try {
    const { email } = req.body;
    const users = await readUsers();
    const user = users.find(u => u.email === email);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = Date.now() + 3600000; // 1 hour from now

      await writeUsers(users);
      // We don't await this so the request finishes faster
      sendPasswordResetEmail(user, resetToken);
    }

    // Always return a generic success message to prevent email enumeration
    res.status(200).json({ message: 'Si tu correo electrónico está en nuestros registros, recibirás un enlace para restablecer tu contraseña.' });
  } catch (error) {
    console.error('[POST /api/auth/forgot-password] Error:', error);
    // Do not reveal if the error was because the user was not found or something else
    res.status(200).json({ message: 'Si tu correo electrónico está en nuestros registros, recibirás un enlace para restablecer tu contraseña.' });
  } finally {
    releaseLock();
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  await acquireLock();
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'El token y la nueva contraseña son requeridos.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const users = await readUsers();
    const user = users.find(
      u => u.passwordResetToken === hashedToken && u.passwordResetExpires > Date.now()
    );

    if (!user) {
      return res.status(400).json({ message: 'El token para restablecer la contraseña es inválido o ha expirado.' });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await writeUsers(users);

    res.status(200).json({ message: 'Tu contraseña ha sido restablecida exitosamente.' });
  } catch (error) {
    console.error('[POST /api/auth/reset-password] Error:', error);
    res.status(500).json({ message: 'Ocurrió un error al restablecer la contraseña.' });
  } finally {
    releaseLock();
  }
});

module.exports = router;