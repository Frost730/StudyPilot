import mongoose, { Schema } from 'mongoose';

const ScheduleBlockSchema = new Schema({
  day: {
    type: String,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  tasks: {
    type: [String],
    default: [],
  },
  completed: {
    type: Boolean,
    default: false,
  },
});

const WeeklyGoalSchema = new Schema({
  weekNumber: {
    type: Number,
    required: true,
  },
  goal: {
    type: String,
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
});

const StudyPlanSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  examDate: {
    type: Date,
    required: true,
  },
  topics: {
    type: [String],
    required: true,
  },
  dailyStudyHours: {
    type: Number,
    required: true,
  },
  weeklyGoals: [WeeklyGoalSchema],
  schedule: [ScheduleBlockSchema],
  revisionPlan: {
    type: String, // markdown overview
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('StudyPlan', StudyPlanSchema);
