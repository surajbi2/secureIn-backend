import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = express.Router();
const { authenticateToken } = auth;

const generatePassId = () => {
    // Generate a UUID and use first 6 characters
    return uuidv4().substring(0, 6).toUpperCase();
};

// Helper to format datetime string for MySQL - just pass through the format
const formatToMySQLDateTime = (dateStr) => {
    console.log('formatToMySQLDateTime input:', dateStr);
    if (!dateStr) return null;
    return dateStr;
};

// Create new entry pass route
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            visitorName,
            visitorPhone,
            visitType,
            idType,
            idNumber,
            eventId,
            studentName,
            relationToStudent,
            department,
            purpose,
            validFrom,
            validUntil } = req.body;     
        const passId = generatePassId();
        // Use the QR verification URL from the frontend
        // const verificationUrl = `http://localhost:5173/qr-verify-pass/${passId}`;
        const verificationUrl = `https://secure-in.vercel.app/qr-verify-pass/${passId}`;
        const qrCode = await QRCode.toDataURL(verificationUrl);

        // Store dates exactly as received
        const [result] = await db.query(
            `INSERT INTO entry_passes (
                pass_id, visitor_name, visitor_phone, visit_type, 
                id_type, id_number, event_id, student_name, 
                relation_to_student, department, purpose, 
                valid_from, valid_until, qr_code, created_by, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                passId, visitorName, visitorPhone, visitType,
                idType, idNumber, eventId || null, studentName,
                relationToStudent, department, purpose,
                validFrom, validUntil, qrCode, req.user.id, 'active'
            ]
        );

        const [passes] = await db.query('SELECT * FROM entry_passes WHERE id = ?', [result.insertId]);
        // Return the pass without any date formatting
        res.status(201).json({
            message: 'Entry pass created successfully',
            pass: passes[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify and record entry with proper UTC date parsing
router.post('/:passId/entry', authenticateToken, async (req, res) => {
    try {
        const { passId } = req.params;

        const [passes] = await db.query(
            'SELECT * FROM entry_passes WHERE UPPER(pass_id) = UPPER(?)',
            [passId]
        );

        if (passes.length === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }        const pass = passes[0];
        // Get current time in IST
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const validFrom = new Date(pass.valid_from);
        const validUntil = new Date(pass.valid_until);

        if (pass.status !== 'active') {
            return res.status(400).json({ 
                message: 'Pass is no longer active',
                status: pass.status
            });
        }

        if (now < validFrom || now > validUntil) {
            await db.query(
                'UPDATE entry_passes SET status = ? WHERE pass_id = ?',
                ['expired', passId]
            );
            return res.status(400).json({ message: 'Pass has expired' });
        }

        await db.query(
            'UPDATE entry_passes SET entry_time = CURRENT_TIMESTAMP, status = ? WHERE pass_id = ?',
            ['used', passId]
        );

        res.json({ message: 'Entry recorded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Record exit
router.post('/:passId/exit', authenticateToken, async (req, res) => {
    try {
        const { passId } = req.params;        const [result] = await db.query(
            'UPDATE entry_passes SET exit_time = CONVERT_TZ(NOW(), "UTC", "Asia/Kolkata") WHERE pass_id = ?',
            [passId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }

        // Get the updated exit time
        const [updated] = await db.query(
            'SELECT exit_time FROM entry_passes WHERE pass_id = ?',
            [passId]
        );

        res.json({ 
            message: 'Exit recorded successfully',
            exitTime: updated[0].exit_time
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get active and expired passes
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        
        // First update any expired passes
        await db.query(
            `UPDATE entry_passes 
             SET status = 'expired' 
             WHERE (status = 'active' OR status = 'used') 
             AND valid_until < ? 
             AND deleted_at IS NULL`, 
            [now]
        );        // Then get all active and recently expired passes
        const [passes] = await db.query(
            `SELECT ep.*, e.name as event_name, u.name as creator_name, u.role as creator_role
             FROM entry_passes ep
             LEFT JOIN events e ON ep.event_id = e.id
             LEFT JOIN users u ON ep.created_by = u.id
             WHERE ep.deleted_at IS NULL
             AND (
                 (ep.status IN ('active', 'used') AND ep.valid_until >= ?)
                 OR (ep.status = 'expired' AND DATE(ep.valid_until) = DATE(?))
             )
             ORDER BY 
                CASE 
                    WHEN ep.status = 'expired' THEN 2
                    WHEN ep.status = 'used' AND ep.exit_time IS NOT NULL THEN 1
                    ELSE 0
                END,
                ep.valid_until DESC`,
            [now, now]
        );

        res.json(passes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify pass by passId route
router.get('/verify/:passId', async (req, res) => {
    try {
        const { passId } = req.params;        const [passes] = await db.query(
            `SELECT ep.*, e.name as event_name, u.name as creator_name, u.role as creator_role
             FROM entry_passes ep 
             LEFT JOIN events e ON ep.event_id = e.id
             LEFT JOIN users u ON ep.created_by = u.id 
             WHERE ep.pass_id = ? AND ep.deleted_at IS NULL`,
            [passId]
        );

        if (passes.length === 0) {
            return res.status(404).json({ 
                code: 'NOT_FOUND',
                message: 'The entry pass you are looking for could not be found. It may have been deleted or never existed.',
                id: passId
            });
        }

        const pass = passes[0];
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const validFrom = new Date(pass.valid_from);
        const validUntil = new Date(pass.valid_until);

        let validation_message = '';
        let currentStatus = pass.status;

        // Check validity periods
        if (now > validUntil && currentStatus === 'active') {
            currentStatus = 'expired';
            validation_message = 'Pass has expired';
            // Update the status in database
            await db.query(
                'UPDATE entry_passes SET status = ? WHERE pass_id = ?',
                ['expired', passId]
            );
        } else if (now < validFrom) {
            validation_message = 'Pass is not yet valid';
        } else if (currentStatus === 'cancelled') {
            validation_message = 'This pass has been cancelled';
        } else if (currentStatus === 'deleted') {
            validation_message = 'This pass has been deleted';
        } else if (currentStatus === 'expired') {
            validation_message = 'Pass has expired';
        } else {            // Pass is active, check entry status
            if (pass.entry_status === 'exited') {
                validation_message = 'Pass has been fully used';
            } else if (pass.entry_status === 'entered') {
                validation_message = 'Visitor is currently inside, awaiting exit scan';
            } else {
                validation_message = 'Pass is valid and ready for entry';
            }
        }

        return res.json({ 
            pass: {
                ...pass,
                status: currentStatus,
                validation_message
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify and record entry/exit
router.post('/:passId/verify', authenticateToken, async (req, res) => {
    try {
        const { passId } = req.params;        // Get the current state of the pass
        const [passes] = await db.query(
            `SELECT ep.*, e.name as event_name, u.name as creator_name, u.role as creator_role
             FROM entry_passes ep 
             LEFT JOIN events e ON ep.event_id = e.id 
             LEFT JOIN users u ON ep.created_by = u.id
             WHERE UPPER(ep.pass_id) = UPPER(?) AND ep.deleted_at IS NULL`,
            [passId]
        );

        if (passes.length === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }

        const pass = passes[0];
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const validFrom = new Date(pass.valid_from);
        const validUntil = new Date(pass.valid_until);

        // Check expiration and validity
        if (now > validUntil) {
            await db.query(
                'UPDATE entry_passes SET status = "expired" WHERE pass_id = ?',
                [passId]
            );
            return res.status(400).json({ 
                message: 'Pass has expired',
                validUntil: validUntil
            });
        }

        if (now < validFrom) {
            return res.status(400).json({ 
                message: 'Pass is not yet valid',
                validFrom: validFrom
            });
        }

        // Check if pass is in a valid state
        if (pass.status !== 'active') {
            return res.status(400).json({ 
                message: `Pass is ${pass.status.toLowerCase()}`,
                status: pass.status
            });
        }        // Handle entry/exit states
        // Check current state first
        const [currentState] = await db.query(
            'SELECT entry_status, entry_time, exit_time FROM entry_passes WHERE pass_id = ?',
            [passId]
        );

        // Check if pass has been fully used (both entry and exit recorded)
        if (currentState[0].entry_status === 'exited') {
            return res.status(400).json({
                message: 'Pass has already been fully used',
                pass: pass
            });
        }        // Handle first scan (entry)
        if (!currentState[0].entry_time || currentState[0].entry_status !== 'entered') {
            // Record entry
            const [result] = await db.query(
                `UPDATE entry_passes 
                 SET entry_time = UTC_TIMESTAMP(), 
                     entry_status = 'entered',
                     exit_time = NULL
                 WHERE pass_id = ? AND (entry_status IS NULL OR entry_status != 'entered')`,
                [passId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to update entry time');
            }

            // Get the updated pass data
            const [updated] = await db.query(
                'SELECT * FROM entry_passes WHERE pass_id = ?',
                [passId]
            );

            return res.json({
                message: 'Entry recorded successfully',
                action: 'entry',
                pass: updated[0]
            });
        }        if (currentState[0].entry_time && currentState[0].entry_status === 'entered' && !currentState[0].exit_time) {
            // Second scan - record exit
            const [result] = await db.query(
                `UPDATE entry_passes 
                 SET exit_time = UTC_TIMESTAMP(),
                     entry_status = 'exited'
                 WHERE pass_id = ? AND entry_status = 'entered' AND exit_time IS NULL`,
                [passId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to update exit time');
            }

            // Get the updated pass data
            const [updated] = await db.query(
                'SELECT * FROM entry_passes WHERE pass_id = ?',
                [passId]
            );

            return res.json({
                message: 'Exit recorded successfully',
                action: 'exit',
                pass: updated[0]
            });
        }

        if (pass.exit_time) {
            return res.status(400).json({
                message: 'Pass has already been used for both entry and exit',
                pass: pass
            });
        }

        return res.status(400).json({
            message: 'Invalid pass state',
            pass: pass
        });

    } catch (error) {
        console.error('Error in pass verification:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Get detailed pass statistics
router.get('/statistics', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        let whereClause = [];
        const params = [];

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

        const whereString = whereClause.length ? 'WHERE ' + whereClause.join(' AND ') : '';

        const [stats] = await db.query(`
            SELECT
                COUNT(*) as total_passes,
                COUNT(CASE WHEN entry_time IS NOT NULL THEN 1 END) as total_entries,
                COUNT(CASE WHEN exit_time IS NOT NULL THEN 1 END) as total_exits,
                COUNT(CASE WHEN entry_time IS NOT NULL AND exit_time IS NULL THEN 1 END) as currently_inside,
                COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_passes,
                AVG(TIMESTAMPDIFF(MINUTE, entry_time, exit_time)) as avg_visit_duration
            FROM entry_passes
            ${whereString}
        `, params);

        // Get department-wise statistics
        const [deptStats] = await db.query(`
            SELECT
                department,
                COUNT(*) as total_passes,
                COUNT(CASE WHEN entry_time IS NOT NULL THEN 1 END) as total_entries,
                COUNT(CASE WHEN entry_time IS NOT NULL AND exit_time IS NULL THEN 1 END) as currently_inside,
                AVG(TIMESTAMPDIFF(MINUTE, entry_time, exit_time)) as avg_visit_duration
            FROM entry_passes
            ${whereString}
            GROUP BY department
            ORDER BY total_entries DESC
        `, params);

        // Get hourly distribution
        const [hourlyStats] = await db.query(`
            SELECT
                HOUR(entry_time) as hour,
                COUNT(*) as entries
            FROM entry_passes
            WHERE entry_time IS NOT NULL
            ${whereString ? 'AND ' + whereClause.join(' AND ') : ''}
            GROUP BY HOUR(entry_time)
            ORDER BY hour
        `, params);

        res.json({
            overall: stats[0],
            departmentWise: deptStats,
            hourlyDistribution: hourlyStats
        });
    } catch (error) {
        console.error('Error fetching pass statistics:', error);
        res.status(500).json({ message: 'Server error fetching statistics' });
    }
});

// Soft delete pass by passId route
router.patch('/:passId/soft-delete', authenticateToken, async (req, res) => {
    try {
        const { passId } = req.params;
        const [result] = await db.query(
            'UPDATE entry_passes SET status = ?, deleted_at = CURRENT_TIMESTAMP WHERE pass_id = ?',
            ['deleted', passId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }
        res.json({ message: 'Pass deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Hard delete pass by passId route (admin only)
router.delete('/:passId', authenticateToken, async (req, res) => {
    try {
        const { passId } = req.params;
        const [result] = await db.query(
            'DELETE FROM entry_passes WHERE pass_id = ?',
            [passId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }
        res.json({ message: 'Pass deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
