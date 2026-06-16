import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';
import Quiz from '../models/Quiz';
import Document from '../models/Document';
import Chunk from '../models/Chunk';
import { generateStructuredJson } from '../services/geminiService';

/**
 * Generate a quiz from document text using Gemini
 */
export const generateQuiz = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { documentId, count = 5, duration = 10 } = req.body;

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    // Verify document ownership
    const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Retrieve chunks to formulate context
    const allChunks = await Chunk.find({ documentId }).limit(10).lean();
    if (allChunks.length === 0) {
      return res.status(400).json({ message: 'No document text found to generate quiz' });
    }

    const contextText = allChunks.map((c) => c.content).join('\n\n');

    const prompt = `Generate exactly ${count} quiz questions based on this study text:\n\n${contextText}`;

    const systemInstruction = `You are a professional examiner. Generate a JSON object representing a study quiz.
    The quiz must consist of a combination of MCQs, True/False, and Short Answer questions.
    Each MCQ must have 4 options. True/False questions must have options: ["True", "False"].
    Short Answer questions should have no options, but must provide a model correctAnswer (the expected definition/answer).
    
    Structure the response exactly as:
    {
      "title": "Quiz Title (e.g. Memory Management Practice Quiz)",
      "questions": [
        {
          "questionText": "Question text here...",
          "type": "mcq", // must be 'mcq', 'true-false', or 'short-answer'
          "options": ["Option A", "Option B", "Option C", "Option D"], // empty for short-answer
          "correctAnswer": "Option B", // For MCQ/TF, must match one of the options. For short-answer, the ideal answer.
          "explanation": "Explanation for why this is the correct answer."
        }
      ]
    }`;

    interface GeminiQuizResponse {
      title: string;
      questions: {
        questionText: string;
        type: 'mcq' | 'true-false' | 'short-answer';
        options: string[];
        correctAnswer: string;
        explanation: string;
      }[];
    }

    const result = await generateStructuredJson<GeminiQuizResponse>(prompt, systemInstruction);

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error('Invalid quiz format returned from Gemini');
    }

    // Attach generated IDs to questions for answer matching
    const quizQuestions = result.questions.map((q) => ({
      _id: new mongoose.Types.ObjectId(),
      questionText: q.questionText,
      type: q.type,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
    }));

    // Save quiz to DB
    const newQuiz = new Quiz({
      userId: req.user.id,
      documentId: doc._id,
      title: result.title || `Quiz on ${doc.name}`,
      questions: quizQuestions,
      duration: Number(duration) || 10,
      completed: false,
    });

    await newQuiz.save();

    return res.status(201).json({
      message: 'Quiz generated successfully',
      quiz: newQuiz,
    });
  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error generating quiz' });
  }
};

/**
 * Fetch all quizzes for the user
 */
export const getQuizzes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const quizzes = await Quiz.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ quizzes });
  } catch (error) {
    console.error('Fetch quizzes error:', error);
    return res.status(500).json({ message: 'Internal server error fetching quizzes' });
  }
};

/**
 * Fetch a single quiz
 */
export const getQuizById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const quiz = await Quiz.findOne({ _id: id, userId: req.user.id });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    return res.status(200).json({ quiz });
  } catch (error) {
    console.error('Fetch quiz by ID error:', error);
    return res.status(500).json({ message: 'Internal server error fetching quiz' });
  }
};

/**
 * Submit quiz answers and calculate score
 */
export const submitQuiz = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { answers } = req.body; // Array of { questionId: string, selectedAnswer: string }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Answers array is required' });
    }

    const quiz = await Quiz.findOne({ _id: id, userId: req.user.id });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found or unauthorized' });
    }

    if (quiz.completed) {
      return res.status(400).json({ message: 'This quiz has already been completed' });
    }

    let correctCount = 0;
    const gradedAnswers = quiz.questions.map((question: any) => {
      const userAnswer = answers.find((a: any) => a.questionId === question._id.toString());
      const selected = userAnswer ? userAnswer.selectedAnswer.trim() : '';
      
      let isCorrect = false;

      if (question.type === 'mcq' || question.type === 'true-false') {
        isCorrect = selected.toLowerCase() === question.correctAnswer.trim().toLowerCase();
      } else {
        // For short-answer, since spelling/phrasing varies, we will do a simple non-empty length check 
        // and display correct model answers to user for self-grading comparison, but let's count it 
        // as correct if they entered at least 5 characters.
        isCorrect = selected.length > 5;
      }

      if (isCorrect) {
        correctCount++;
      }

      return {
        questionId: question._id,
        selectedAnswer: selected,
        isCorrect,
      };
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);

    quiz.score = score;
    quiz.userAnswers = gradedAnswers as any;
    quiz.completed = true;
    quiz.completedAt = new Date();

    await quiz.save();

    return res.status(200).json({
      message: 'Quiz submitted and graded successfully',
      quiz,
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    return res.status(500).json({ message: 'Internal server error submitting quiz' });
  }
};
