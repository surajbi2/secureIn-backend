import express from 'express';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = express.Router();
const { authenticateToken } = auth;

// Get all events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT e.*, u.name as creator_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.start_date DESC
    `);
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, venue, startDate, endDate } = req.body;

    const [result] = await db.query(
      `INSERT INTO events (name, description, venue, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description, venue, startDate, endDate, req.user.id]
    );

    const [createdEvent] = await db.query(
      'SELECT * FROM events WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Event created successfully',
      event: createdEvent[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, venue, startDate, endDate } = req.body;

    const [result] = await db.query(
      `UPDATE events 
       SET name = ?, description = ?, venue = ?, start_date = ?, end_date = ?
       WHERE id = ?`,
      [name, description, venue, startDate, endDate, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const [updatedEvent] = await db.query(
      'SELECT * FROM events WHERE id = ?',
      [req.params.id]
    );

    res.json({
      message: 'Event updated successfully',
      event: updatedEvent[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if there are any entry passes associated with this event
    const [passes] = await db.query(
      'SELECT COUNT(*) as count FROM entry_passes WHERE event_id = ?',
      [req.params.id]
    );

    if (passes[0].count > 0) {
      return res.status(400).json({
        message: 'Cannot delete event that has associated entry passes'
      });
    }

    const [result] = await db.query(
      'DELETE FROM events WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get event by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [events] = await db.query(
      `SELECT e.*, u.name as creator_name
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = ?`,
      [req.params.id]
    );

    if (events.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(events[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
