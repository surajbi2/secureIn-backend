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
            validUntil        } = req.body;        const passId = generatePassId();
        // Use the QR verification URL from the frontend
        const verificationUrl = `http://localhost:5173/qr-verify-pass/${passId}`;
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
        const { passId } = req.params;

        const [result] = await db.query(
            'UPDATE entry_passes SET exit_time = CURRENT_TIMESTAMP WHERE pass_id = ?',
            [passId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }

        res.json({ message: 'Exit recorded successfully' });
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
             WHERE status = 'active' 
             AND valid_until < ?`, 
            [now]
        );        // Then get all passes
        const [passes] = await db.query(
            `SELECT ep.*, e.name as event_name 
             FROM entry_passes ep
             LEFT JOIN events e ON ep.event_id = e.id
             WHERE ep.status IN ('active', 'expired')
             AND ep.deleted_at IS NULL
             ORDER BY 
                CASE 
                    WHEN ep.status = 'expired' AND DATE(ep.valid_until) = DATE(?) THEN 0
                    WHEN ep.status = 'active' THEN 1
                    ELSE 2
                END,
                ep.valid_until DESC`,
            [now]
        );
        // Send the raw dates without formatting
        res.json(passes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify pass by passId route
router.get('/verify/:passId', async (req, res) => {
    try {
        const { passId } = req.params;
        const [passes] = await db.query(
            'SELECT * FROM entry_passes WHERE pass_id = ?',
            [passId]
        );

        if (passes.length === 0) {
            return res.status(404).json({ message: 'Pass not found' });
        }
        const pass = passes[0];

        // Check pass validity
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const validFrom = new Date(pass.valid_from);
        const validUntil = new Date(pass.valid_until);

        if (pass.status !== 'active') {
            return res.json({ 
                pass: {
                    ...pass,
                    status: pass.status,
                    validation_message: 'Pass is no longer active'
                }
            });
        }

        if (now < validFrom) {
            return res.json({ 
                pass: {
                    ...pass,
                    status: 'pending',
                    validation_message: 'Pass is not yet valid'
                }
            });
        }

        if (now > validUntil) {
            // Update pass to expired status
            await db.query(
                'UPDATE entry_passes SET status = ? WHERE pass_id = ?',
                ['expired', passId]
            );
            return res.json({ 
                pass: {
                    ...pass,
                    status: 'expired',
                    validation_message: 'Pass has expired'
                }
            });
        }

        // Pass is valid
        return res.json({ 
            pass: {
                ...pass,
                validation_message: 'Pass is valid'
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
