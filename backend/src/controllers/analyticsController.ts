import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Document from '../models/Document';
import Chat from '../models/Chat';
import Notes from '../models/Notes';
import Flashcard from '../models/Flashcard';
import Quiz from '../models/Quiz';

/**
 * Gather analytics for the authenticated user
 */
export const getUserAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = req.user.id;

    // 1. Count documents
    const docCount = await Document.countDocuments({ userId });

    // 2. Count questions asked (messages in Chat collection from 'user')
    const chatSessions = await Chat.find({ userId }).lean();
    let questionCount = 0;
    chatSessions.forEach((chat) => {
      const userMsgs = chat.messages.filter((m) => m.role === 'user');
      questionCount += userMsgs.length;
    });

    // 3. Count notes generated
    const notesCount = await Notes.countDocuments({ userId });

    // 4. Flashcards statistics
    const totalFlashcards = await Flashcard.countDocuments({ userId });
    const learnedFlashcards = await Flashcard.countDocuments({ userId, status: 'learned' });

    // 5. Quiz statistics
    const completedQuizzes = await Quiz.find({ userId, completed: true }).lean();
    const quizCount = completedQuizzes.length;
    
    let avgQuizScore = 0;
    if (quizCount > 0) {
      const totalScore = completedQuizzes.reduce((acc, q) => acc + (q.score || 0), 0);
      avgQuizScore = Math.round(totalScore / quizCount);
    }

    // 6. Recent quiz attempts data for visual lists
    const recentQuizzes = completedQuizzes
      .sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5)
      .map((q) => ({
        id: q._id,
        title: q.title,
        score: q.score,
        completedAt: q.completedAt,
      }));

    return res.status(200).json({
      analytics: {
        documentsUploaded: docCount,
        questionsAsked: questionCount,
        notesGenerated: notesCount,
        flashcards: {
          total: totalFlashcards,
          learned: learnedFlashcards,
          reviewPending: totalFlashcards - learnedFlashcards,
        },
        quizzes: {
          totalTaken: quizCount,
          averageScore: avgQuizScore,
          recentAttempts: recentQuizzes,
        },
      },
    });
  } catch (error) {
    console.error('Analytics aggregation error:', error);
    return res.status(500).json({ message: 'Internal server error aggregating user analytics' });
  }
};
