const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readUsers, writeUsers, acquireLock, releaseLock } = require('../utils');
const config = require('../config');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  await acquireLock();
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const users = await readUsers();
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: new Date().getTime().toString(), // simple unique id
      name,
      email,
      password: hashedPassword,
      role: 'user', // default role
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
      { id: user.id, email: user.email, role: user.role },
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

module.exports = router;
