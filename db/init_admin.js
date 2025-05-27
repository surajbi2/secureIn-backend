import bcrypt from 'bcryptjs';
import db from '../config/db.js';

const initializeAdmin = async () => {
    try {
        // Check if admin exists
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', ['admin@cuk.ac.in']);
        
        if (users.length === 0) {
            // Create admin user
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            await db.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Admin', 'admin@cuk.ac.in', hashedPassword, 'admin']
            );
            
            console.log('Admin user created successfully');
        } else {
            console.log('Admin user already exists');
        }
    } catch (error) {
        console.error('Error initializing admin:', error);
    }
};

initializeAdmin();
