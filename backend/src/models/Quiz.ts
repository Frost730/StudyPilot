import mongoose, { Schema } from 'mongoose';

const QuizQuestionSchema = new Schema({
  questionText: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['mcq', 'true-false', 'short-answer'],
    required: true,
  },
  options: {
    type: [String], // only for mcq
    default: [],
  },
  correctAnswer: {
    type: String,
    required: true, // for MCQ/TF, or model answer for short
  },
  explanation: {
    type: String,
    default: '',
  },
});

const UserAnswerSchema = new Schema({
  questionId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  selectedAnswer: {
    type: String,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
});

const QuizSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  questions: [QuizQuestionSchema],
  duration: {
    type: Number, // in minutes
    default: 10,
  },
  score: {
    type: Number, // percentage score, e.g. 85 for 85%
    default: 0,
  },
  userAnswers: [UserAnswerSchema],
  completed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
});

export default mongoose.model('Quiz', QuizSchema);
