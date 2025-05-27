import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', { email }); // Debug log

    // Check if user exists
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    
    console.log('Found users:', users.length); // Debug log
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];    // Verify password (plain text comparison)
    if (password !== user.password) {
      console.log('Invalid password'); // Debug log
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Login successful for user:', user.email); // Debug log

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token route
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Verify route called with token:', token);

  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    // Fetch full user details from DB
    const [users] = await db.query('SELECT id, email, role, name FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0) {
      console.log('User not found for id:', decoded.id);
      return res.status(404).json({ message: 'User not found.' });
    }
    const user = users[0];
    console.log('User found:', user);
    res.json({ user });
  } catch (error) {
    console.log('Invalid token error:', error.message);
    res.status(403).json({ message: 'Invalid token.' });
  }
});

// Register route (for admin use only)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }    // Insert new user with plain text password
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, role]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
