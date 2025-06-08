import express from 'express';
import db from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
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

    // Get entry/exit statistics
    const [entryExitStatsResult] = await db.query(`
      SELECT 
        COUNT(CASE WHEN exit_time IS NULL AND status = 'active' THEN 1 END) as currently_inside,
        COUNT(CASE WHEN exit_time IS NOT NULL THEN 1 END) as total_exits,
        COUNT(*) as total_entries
      FROM entry_passes
      WHERE valid_from >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    const entryExitStats = entryExitStatsResult[0];

    // Recent visitors (last 10) with entry/exit times
    const [recentVisitors] = await db.query(`
      SELECT 
        visitor_name, 
        visit_type, 
        valid_from,
        valid_until,
        department,
        valid_from as entry_time,
        exit_time,
        CASE 
          WHEN exit_time IS NOT NULL THEN 'exited'
          WHEN status = 'active' THEN 'inside'
          WHEN status = 'expired' THEN 'expired'
          ELSE status
        END as current_status
      FROM entry_passes 
      ORDER BY valid_from DESC 
      LIMIT 10
    `);

    res.json({
      visitorEntries,
      passesGenerated,
      eventsCount,
      entryExitStats,
      recentVisitors
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error fetching reports' });
  }
});

// Detailed visitor logs with filtering
router.get('/visitor-logs', authenticateToken, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      department, 
      visitType,
      status,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = [];

    if (startDate) {
      whereClause.push('valid_from >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClause.push('valid_until <= ?');
      params.push(endDate);
    }
    if (department) {
      whereClause.push('department = ?');
      params.push(department);
    }
    if (visitType) {
      whereClause.push('visit_type = ?');
      params.push(visitType);
    }
    if (status) {
      if (status === 'inside') {
        whereClause.push('exit_time IS NULL AND status = "active"');
      } else if (status === 'exited') {
        whereClause.push('exit_time IS NOT NULL');
      } else {
        whereClause.push('status = ?');
        params.push(status);
      }
    }

    const whereString = whereClause.length ? 'WHERE ' + whereClause.join(' AND ') : '';

    // Get total count for pagination
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM entry_passes ${whereString}`,
      params
    );
    const totalRecords = countResult[0].total;

    // Get filtered visitor logs
    const query = `
      SELECT 
        pass_id,
        visitor_name,
        visitor_phone,
        visit_type,
        department,
        purpose,
        valid_from as entry_time,
        exit_time,
        CASE 
          WHEN exit_time IS NOT NULL THEN 'exited'
          WHEN status = 'active' THEN 'inside'
          WHEN status = 'expired' THEN 'expired'
          ELSE status
        END as current_status,
        TIMESTAMPDIFF(MINUTE, valid_from, IFNULL(exit_time, NOW())) as duration_minutes
      FROM entry_passes
      ${whereString}
      ORDER BY valid_from DESC
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), Number(offset));
    const [logs] = await db.query(query, params);

    // Get department statistics
    const [deptStats] = await db.query(`
      SELECT 
        department,
        COUNT(*) as total_visits,
        COUNT(CASE WHEN exit_time IS NULL AND status = 'active' THEN 1 END) as currently_inside,
        AVG(TIMESTAMPDIFF(MINUTE, valid_from, exit_time)) as avg_duration_minutes
      FROM entry_passes
      ${whereString}
      GROUP BY department
    `, params.slice(0, -2));

    res.json({
      logs,
      deptStats,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalRecords / limit),
        totalRecords,
        limit: Number(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching visitor logs:', error);
    res.status(500).json({ message: 'Server error fetching visitor logs' });
  }
});

export default router;
