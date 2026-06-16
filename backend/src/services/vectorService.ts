import Chunk from '../models/Chunk';
import Document from '../models/Document';

export interface SimilarityResult {
  chunkId: string;
  content: string;
  pageNumber: number;
  documentId: string;
  documentName: string;
  score: number;
}

/**
 * Calculates the cosine similarity between two vectors
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(vecA.length, vecB.length);
  
  for (let i = 0; i < length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Performs a vector search over the user's document chunks in MongoDB using Cosine Similarity
 */
export const searchSimilarChunks = async (
  userId: string,
  queryVector: number[],
  limit: number = 5,
  documentId?: string
): Promise<SimilarityResult[]> => {
  // 1. Build the query filter
  const filter: any = { userId };
  if (documentId) {
    filter.documentId = documentId;
  }

  // 2. Fetch the chunks and populate their document names
  const chunks = await Chunk.find(filter).lean();
  if (chunks.length === 0) return [];

  // Fetch document details to map document names
  const docIds = Array.from(new Set(chunks.map(c => c.documentId.toString())));
  const docs = await Document.find({ _id: { $in: docIds } }).lean();
  const docMap = new Map(docs.map(d => [d._id.toString(), d.name]));

  // 3. Compute cosine similarity for each chunk
  const scoredChunks: SimilarityResult[] = chunks.map((chunk: any) => {
    const score = cosineSimilarity(queryVector, chunk.embedding);
    return {
      chunkId: chunk._id.toString(),
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      documentId: chunk.documentId.toString(),
      documentName: docMap.get(chunk.documentId.toString()) || 'Unknown Document',
      score,
    };
  });

  // 4. Sort by score descending and take the top k
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, limit);
};
