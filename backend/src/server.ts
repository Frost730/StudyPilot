import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Import routes
import authRoutes from './routes/authRoutes';
import documentRoutes from './routes/documentRoutes';
import chatRoutes from './routes/chatRoutes';
import notesRoutes from './routes/notesRoutes';
import flashcardRoutes from './routes/flashcardRoutes';
import quizRoutes from './routes/quizRoutes';
import plannerRoutes from './routes/plannerRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // In production, replace with actual frontend domain (Vercel)
  credentials: true,
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check Endpoint
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', message: 'AI Study Assistant API is running' });
});

// Bind API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/analytics', analyticsRoutes);

// Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Database Connection & Server Startup
const connectDatabaseAndStart = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-study-assistant';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully.');

    app.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed. Exiting process...', error);
    process.exit(1);
  }
};

connectDatabaseAndStart();
