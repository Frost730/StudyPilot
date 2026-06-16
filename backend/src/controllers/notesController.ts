import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Notes from '../models/Notes';
import Document from '../models/Document';
import Chunk from '../models/Chunk';
import { generateStructuredJson } from '../services/geminiService';

/**
 * Generate study notes from document text using Gemini
 */
export const generateNotes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    // Verify document exists and belongs to the user
    const doc = await Document.findOne({ _id: documentId, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Get a sample of chunks to extract content for notes generation
    // To make a good summary without hitting context limits, we grab up to 10 chunks evenly distributed
    const allChunks = await Chunk.find({ documentId }).sort({ pageNumber: 1 }).lean();
    if (allChunks.length === 0) {
      return res.status(400).json({ message: 'Document has no text content available to summarize' });
    }

    // Distribute sample chunks evenly across the document pages
    const sampledChunks = [];
    const step = Math.max(1, Math.floor(allChunks.length / 8));
    for (let i = 0; i < allChunks.length; i += step) {
      sampledChunks.push(allChunks[i].content);
      if (sampledChunks.length >= 8) break;
    }

    const docContext = sampledChunks.join('\n\n');
    
    const prompt = `Generate comprehensive study notes for the document titled "${doc.name}" based on this reference text:\n\n${docContext}`;
    
    const systemInstruction = `You are an expert tutor. Your task is to write detailed study notes based on the provided text.
    You must structure the notes under these EXACT markdown sections:
    # Title: [A descriptive title]
    
    ## Chapter Summary
    [Provide a concise 2-3 paragraph summary of the core topics discussed in the text]
    
    ## Key Concepts
    [List 3-5 key concepts with bullet points and detailed explanations]
    
    ## Important Definitions
    [List any critical definitions, formulas, or acronyms introduced, in bold]
    
    ## Exam Tips
    [Provide 3 practical exam tips, highlighting likely questions, tricky points, or study hints]
    
    You must return a JSON object with two fields:
    {
      "title": "A short descriptive title for the notes (e.g. Chapter 4: Operating System Scheduling)",
      "notesMarkdown": "[The full generated notes structured in markdown as instructed above]"
    }`;

    interface GeminiNotesResponse {
      title: string;
      notesMarkdown: string;
    }

    const geminiResult = await generateStructuredJson<GeminiNotesResponse>(prompt, systemInstruction);

    // Save notes to database
    const newNotes = new Notes({
      userId: req.user.id,
      documentId: doc._id,
      title: geminiResult.title || `Notes for ${doc.name}`,
      content: geminiResult.notesMarkdown,
    });

    await newNotes.save();

    return res.status(201).json({
      message: 'Study notes generated successfully',
      notes: newNotes,
    });
  } catch (error: any) {
    console.error('Notes generation error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error generating notes' });
  }
};

/**
 * Fetch all notes for the logged in user
 */
export const getNotes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const notes = await Notes.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    return res.status(200).json({ notes });
  } catch (error) {
    console.error('Fetch notes error:', error);
    return res.status(500).json({ message: 'Internal server error fetching notes' });
  }
};

/**
 * Get single notes entry
 */
export const getNotesById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const note = await Notes.findOne({ _id: id, userId: req.user.id });

    if (!note) {
      return res.status(404).json({ message: 'Notes not found' });
    }

    return res.status(200).json({ note });
  } catch (error) {
    console.error('Fetch notes by ID error:', error);
    return res.status(500).json({ message: 'Internal server error fetching notes' });
  }
};

/**
 * Update study notes manually
 */
export const updateNotes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const updatedNote = await Notes.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { title, content },
      { new: true }
    );

    if (!updatedNote) {
      return res.status(404).json({ message: 'Notes not found or unauthorized' });
    }

    return res.status(200).json({ note: updatedNote });
  } catch (error) {
    console.error('Update notes error:', error);
    return res.status(500).json({ message: 'Internal server error updating notes' });
  }
};

/**
 * Delete a study notes entry
 */
export const deleteNotes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const deletedNote = await Notes.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deletedNote) {
      return res.status(404).json({ message: 'Notes not found or unauthorized' });
    }

    return res.status(200).json({ message: 'Notes deleted successfully' });
  } catch (error) {
    console.error('Delete notes error:', error);
    return res.status(500).json({ message: 'Internal server error deleting notes' });
  }
};
