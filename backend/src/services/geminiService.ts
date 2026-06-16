import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const getGenAIClient = (): GoogleGenerativeAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables.');
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Generate embedding vector for a single text chunk
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
  try {
    const genAI = getGenAIClient();
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error: any) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
};

/**
 * Generate embeddings in batches for efficiency
 */
export const getEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  try {
    if (texts.length === 0) return [];
    const genAI = getGenAIClient();
    
    // Gemini batch embedding requires requests array
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        model: 'models/text-embedding-004',
      })),
    });
    
    return result.embeddings.map((e) => e.values);
  } catch (error: any) {
    console.error('Error in batch embedding:', error);
    // Fallback to sequential embeddings if batch fails due to api constraints
    console.log('Falling back to sequential embeddings...');
    const embeddings: number[][] = [];
    for (const text of texts) {
      const emb = await getEmbedding(text);
      embeddings.push(emb);
    }
    return embeddings;
  }
};

/**
 * Stream a chat response with context using SSE
 */
export const streamChatResponse = async (
  prompt: string,
  contextText: string,
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    const genAI = getGenAIClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: 'You are a helpful AI Study Assistant. Answer the user\'s question based ONLY on the provided context chunks. Be accurate, and reference the source files and pages if available in the context. If the answer cannot be found in the context, politely state that you do not have enough information from the documents to answer, but offer a general response based on your knowledge while clearly indicating it is not from their documents.',
    });

    const fullPrompt = `Context from user's study documents:\n---\n${contextText}\n---\nQuestion: ${prompt}`;
    const result = await model.generateContentStream(fullPrompt);

    let fullText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(chunkText);
    }

    return fullText;
  } catch (error: any) {
    console.error('Error generating chat stream:', error);
    throw new Error(`Chat generation failed: ${error.message}`);
  }
};

/**
 * Helper to generate structured JSON using JSON mode in Gemini
 */
export const generateStructuredJson = async <T>(
  prompt: string,
  systemInstruction: string
): Promise<T> => {
  try {
    const genAI = getGenAIClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction + ' Return ONLY a valid JSON string fitting the requested structure.',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // Parse response as JSON
    const parsedData = JSON.parse(textResponse) as T;
    return parsedData;
  } catch (error: any) {
    console.error('Error generating structured JSON:', error);
    throw new Error(`JSON generation failed: ${error.message}`);
  }
};
