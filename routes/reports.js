import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Total visitor entries (count of active or used passes)
    const [visitorEntriesResult] = await db.query(
      "SELECT COUNT(*) AS count FROM entry_passes WHERE status IN ('active', 'used')"
    );
    const visitorEntries = visitorEntriesResult[0].count;

    // Total passes generated
    const [passesGeneratedResult] = await db.query(
      "SELECT COUNT(*) AS count FROM entry_passes"
    );
    const passesGenerated = passesGeneratedResult[0].count;

    // Total events count
    const [eventsCountResult] = await db.query(
      "SELECT COUNT(*) AS count FROM events"
    );
    const eventsCount = eventsCountResult[0].count;

    // Recent visitors (last 5)
    const [recentVisitors] = await db.query(
      "SELECT visitor_name, visit_type, valid_from, valid_until FROM entry_passes ORDER BY valid_from DESC LIMIT 10"
    );

    res.json({
      visitorEntries,
      passesGenerated,
      eventsCount,
      recentVisitors,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error fetching reports' });
  }
});

export default router;
