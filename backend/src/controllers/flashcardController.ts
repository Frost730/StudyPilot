import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Flashcard from '../models/Flashcard';
import Document from '../models/Document';
import Chunk from '../models/Chunk';
import { generateStructuredJson } from '../services/geminiService';

/**
 * Generate flashcards from document text using Gemini
 */
export const generateFlashcards = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { documentId, count = 10 } = req.body;

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
      return res.status(400).json({ message: 'No document chunks found' });
    }

    const contextText = allChunks.map((c) => c.content).join('\n\n');

    const prompt = `Generate exactly ${count} educational flashcards based on this context text:\n\n${contextText}`;

    const systemInstruction = `You are a study assistant. Your goal is to extract core definitions, key concepts, questions, and answers from the context and format them as flashcards.
    Return a JSON object containing an array of flashcards. Each flashcard MUST have a "front" (question or concept name) and a "back" (detailed definition, answer, or explanation).
    
    JSON Schema format:
    {
      "flashcards": [
        {
          "front": "What is the primary role of a CPU Scheduler?",
          "back": "To select which process in the ready queue should be allocated CPU execution time next."
        }
      ]
    }`;

    interface GeminiFlashcardResponse {
      flashcards: { front: string; back: string }[];
    }

    const result = await generateStructuredJson<GeminiFlashcardResponse>(prompt, systemInstruction);

    if (!result.flashcards || !Array.isArray(result.flashcards)) {
      throw new Error('Invalid response structure returned from Gemini');
    }

    // Map and insert into MongoDB
    const cardsToSave = result.flashcards.map((card) => ({
      userId: req.user!.id,
      documentId: doc._id,
      front: card.front,
      back: card.back,
      status: 'review',
    }));

    const savedCards = await Flashcard.insertMany(cardsToSave);

    return res.status(201).json({
      message: `Generated ${savedCards.length} flashcards successfully`,
      flashcards: savedCards,
    });
  } catch (error: any) {
    console.error('Flashcard generation error:', error);
    return res.status(500).json({ message: error.message || 'Internal server error generating flashcards' });
  }
};

/**
 * Fetch all flashcards for the user
 */
export const getFlashcards = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { status, documentId } = req.query;
    const filter: any = { userId: req.user.id };

    if (status) {
      filter.status = status;
    }
    if (documentId) {
      filter.documentId = documentId;
    }

    const flashcards = await Flashcard.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({ flashcards });
  } catch (error) {
    console.error('Fetch flashcards error:', error);
    return res.status(500).json({ message: 'Internal server error fetching flashcards' });
  }
};

/**
 * Update flashcard status (e.g. learned vs review)
 */
export const updateFlashcardStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['learned', 'review'].includes(status)) {
      return res.status(400).json({ message: 'Valid status ("learned" or "review") is required' });
    }

    const updatedCard = await Flashcard.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { status },
      { new: true }
    );

    if (!updatedCard) {
      return res.status(404).json({ message: 'Flashcard not found or unauthorized' });
    }

    return res.status(200).json({ flashcard: updatedCard });
  } catch (error) {
    console.error('Update flashcard status error:', error);
    return res.status(500).json({ message: 'Internal server error updating flashcard status' });
  }
};

/**
 * Delete a flashcard
 */
export const deleteFlashcard = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const deletedCard = await Flashcard.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deletedCard) {
      return res.status(404).json({ message: 'Flashcard not found or unauthorized' });
    }

    return res.status(200).json({ message: 'Flashcard deleted successfully' });
  } catch (error) {
    console.error('Delete flashcard error:', error);
    return res.status(500).json({ message: 'Internal server error deleting flashcard' });
  }
};
