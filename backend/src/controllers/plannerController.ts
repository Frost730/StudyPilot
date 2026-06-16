import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import StudyPlan from '../models/StudyPlan';
import { generateStructuredJson } from '../services/geminiService';

/**
 * Generate a study plan using Gemini
 */
export const generateStudyPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { title, examDate, topics, dailyStudyHours } = req.body;

    if (!examDate || !topics || !dailyStudyHours) {
      return res.status(400).json({ message: 'Exam date, topics, and daily hours are required' });
    }

    const parsedTopics = Array.isArray(topics) ? topics : topics.split(',').map((t: string) => t.trim());
    const hours = Number(dailyStudyHours);

    const prompt = `Generate a structured study plan for an exam on ${examDate}.
    Topics to cover: ${parsedTopics.join(', ')}.
    Daily study commitment: ${hours} hours.`;

    const systemInstruction = `You are a professional study coordinator. Generate a JSON object representing a study plan.
    You must divide the time between now and the exam date into weekly goals and a daily calendar schedule.
    
    Structure the response exactly as:
    {
      "weeklyGoals": [
        {
          "weekNumber": 1,
          "goal": "Master core concepts of scheduling and processes."
        }
      ],
      "schedule": [
        {
          "day": "Day 1 (Monday)",
          "topic": "Process scheduling algorithms",
          "tasks": ["Read Chapter 4", "Attempt scheduling exercises", "Summarize scheduler benefits"]
        }
      ],
      "revisionPlan": "A brief summary of how the last 3 days before the exam should be spent on mock testing and final revision."
    }`;

    interface GeminiPlanResponse {
      weeklyGoals: { weekNumber: number; goal: string }[];
      schedule: { day: string; topic: string; tasks: string[] }[];
      revisionPlan: string;
    }

    const result = await generateStructuredJson<GeminiPlanResponse>(prompt, systemInstruction);

    const newPlan = new StudyPlan({
      userId: req.user.id,
      title: title || `Study Plan for ${parsedTopics[0]} Exam`,
      examDate: new Date(examDate),
      topics: parsedTopics,
      dailyStudyHours: hours,
      weeklyGoals: result.weeklyGoals || [],
      schedule: result.schedule ? result.schedule.map(s => ({ ...s, completed: false })) : [],
      revisionPlan: result.revisionPlan || '',
    });

    await newPlan.save();

    return res.status(201).json({
      message: 'Study plan generated successfully',
      plan: newPlan,
    });
  } catch (error: any) {
    console.error('Study plan generation error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error generating study plan' });
  }
};

/**
 * Fetch all study plans for the user
 */
export const getStudyPlans = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const plans = await StudyPlan.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ plans });
  } catch (error) {
    console.error('Fetch study plans error:', error);
    return res.status(500).json({ message: 'Internal server error fetching study plans' });
  }
};

/**
 * Fetch single study plan
 */
export const getStudyPlanById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const plan = await StudyPlan.findOne({ _id: id, userId: req.user.id });

    if (!plan) {
      return res.status(404).json({ message: 'Study plan not found' });
    }

    return res.status(200).json({ plan });
  } catch (error) {
    console.error('Fetch study plan by ID error:', error);
    return res.status(500).json({ message: 'Internal server error fetching study plan' });
  }
};

/**
 * Toggle task status in a study plan schedule
 */
export const toggleScheduleTask = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { planId, blockId } = req.params;

    const plan = await StudyPlan.findOne({ _id: planId, userId: req.user.id });
    if (!plan) {
      return res.status(404).json({ message: 'Study plan not found or unauthorized' });
    }

    const scheduleBlock = plan.schedule.find((s: any) => s._id.toString() === blockId);
    if (!scheduleBlock) {
      return res.status(404).json({ message: 'Schedule block not found' });
    }

    // Toggle completed status
    scheduleBlock.completed = !scheduleBlock.completed;
    await plan.save();

    return res.status(200).json({ plan });
  } catch (error) {
    console.error('Toggle schedule task error:', error);
    return res.status(500).json({ message: 'Internal server error updating task status' });
  }
};
