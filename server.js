import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import eventRoutes from './routes/events.js';
import passesRoutes from './routes/passes.js';
import reportsRoutes from './routes/reports.js';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/passes', passesRoutes);
app.use('/api/reports', reportsRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
