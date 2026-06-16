import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Document from '../models/Document';
import Chunk from '../models/Chunk';
import { parsePdfPages } from '../services/pdfParser';
import { splitPagesIntoChunks } from '../utils/textSplitter';
import { getEmbeddingsBatch } from '../services/geminiService';

/**
 * Process document text, chunk it, generate embeddings and store them in the background
 */
const processDocumentInBackground = async (
  documentId: string,
  userId: string,
  fileBuffer: Buffer
) => {
  try {
    // 1. Parse PDF pages
    const pages = await parsePdfPages(fileBuffer);
    if (pages.length === 0) {
      throw new Error('No readable text found in the PDF.');
    }

    // 2. Segment text into chunks
    const chunks = splitPagesIntoChunks(pages, 800, 150);
    if (chunks.length === 0) {
      throw new Error('Failed to segment PDF contents into chunks.');
    }

    // 3. Generate embeddings for chunks
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await getEmbeddingsBatch(chunkTexts);

    // 4. Save chunks with vectors
    const chunkDocuments = chunks.map((chunk, index) => ({
      documentId,
      userId,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      embedding: embeddings[index],
    }));

    await Chunk.insertMany(chunkDocuments);

    // 5. Update document status to ready
    await Document.findByIdAndUpdate(documentId, { status: 'ready' });
    console.log(`Document ${documentId} processed successfully. Created ${chunks.length} chunks.`);
  } catch (error: any) {
    console.error(`Error processing document ${documentId} in background:`, error);
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      errorMessage: error.message || 'Error occurred during parsing and vector generation.',
    });
  }
};

/**
 * Upload a new PDF document
 */
export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a PDF file' });
    }

    const { originalname, size, buffer } = req.file;

    // Create the document entry as 'processing'
    const newDoc = new Document({
      userId: req.user.id,
      name: originalname,
      size,
      status: 'processing',
    });

    await newDoc.save();

    // Trigger processing in the background
    processDocumentInBackground(newDoc._id.toString(), req.user.id, buffer);

    return res.status(202).json({
      message: 'Document upload accepted and processing started',
      document: newDoc,
    });
  } catch (error: any) {
    console.error('Document upload error:', error);
    return res.status(500).json({ message: 'Internal server error uploading document' });
  }
};

/**
 * Fetch all documents for the logged in user
 */
export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const documents = await Document.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ documents });
  } catch (error) {
    console.error('Fetch documents error:', error);
    return res.status(500).json({ message: 'Internal server error fetching documents' });
  }
};

/**
 * Rename an existing document
 */
export const renameDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Document name is required' });
    }

    const updatedDoc = await Document.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { name: name.trim() },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ message: 'Document not found or unauthorized' });
    }

    return res.status(200).json({ document: updatedDoc });
  } catch (error) {
    console.error('Rename document error:', error);
    return res.status(500).json({ message: 'Internal server error renaming document' });
  }
};

/**
 * Delete a document and its chunks
 */
export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const doc = await Document.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!doc) {
      return res.status(404).json({ message: 'Document not found or unauthorized' });
    }

    // Delete associated vector chunks
    await Chunk.deleteMany({ documentId: id });

    return res.status(200).json({ message: 'Document and associated vector chunks deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    return res.status(500).json({ message: 'Internal server error deleting document' });
  }
};
