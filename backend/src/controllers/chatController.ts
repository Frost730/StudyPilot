import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Chat from '../models/Chat';
import { getEmbedding, streamChatResponse } from '../services/geminiService';
import { searchSimilarChunks } from '../services/vectorService';

/**
 * Handle streaming chat queries using RAG context and Gemini
 */
export const askQuestion = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { prompt, chatId, documentId } = req.body;

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ message: 'Prompt is required' });
    }

    // 1. Generate query embedding vector
    const queryVector = await getEmbedding(prompt);

    // 2. Query similar document chunks (scoped to user, and optionally a single doc)
    const similarChunks = await searchSimilarChunks(req.user.id, queryVector, 5, documentId);

    // 3. Construct context snippet and citations for the AI
    let contextText = '';
    const citations: any[] = [];

    if (similarChunks.length > 0) {
      contextText = similarChunks
        .map(
          (c, idx) =>
            `[Source #${idx + 1}] File: ${c.documentName}, Page: ${c.pageNumber}\nContent: ${c.content}`
        )
        .join('\n\n');

      similarChunks.forEach((c) => {
        citations.push({
          documentId: c.documentId,
          documentName: c.documentName,
          pageNumber: c.pageNumber,
          content: c.content,
        });
      });
    } else {
      contextText = 'No relevant document snippets found. Suggest answering generally.';
    }

    // Set SSE headers for streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Establish the connection immediately

    let generatedResponse = '';

    // 4. Stream response from Gemini
    await streamChatResponse(prompt, contextText, (chunk) => {
      generatedResponse += chunk;
      // Write the chunk to the client
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    // 5. Save the chat session and messages in MongoDB
    let currentChat;
    
    if (chatId) {
      currentChat = await Chat.findOne({ _id: chatId, userId: req.user.id });
    }

    if (!currentChat) {
      // Create a new Chat session
      const docTitle = prompt.length > 40 ? prompt.substring(0, 37) + '...' : prompt;
      currentChat = new Chat({
        userId: req.user.id,
        title: docTitle,
        messages: [],
      });
    }

    // Push the user message and the assistant's cited response
    currentChat.messages.push({
      role: 'user',
      content: prompt,
      citations: [],
    });

    currentChat.messages.push({
      role: 'assistant',
      content: generatedResponse,
      citations: citations,
    });

    await currentChat.save();

    // Send the final event specifying completion and including details
    res.write(
      `data: ${JSON.stringify({
        done: true,
        chatId: currentChat._id,
        citations: citations,
        fullText: generatedResponse,
      })}\n\n`
    );
    res.end();
  } catch (error: any) {
    console.error('Chat error:', error);
    // Write the error block if SSE was already initialized
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Internal server error in RAG engine' });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || 'Error occurred in generation' })}\n\n`);
      res.end();
    }
  }
};

/**
 * Fetch list of all chat sessions for the user (for sidebars)
 */
export const getChatHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const chats = await Chat.find({ userId: req.user.id })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 });

    return res.status(200).json({ chats });
  } catch (error) {
    console.error('Fetch chat history error:', error);
    return res.status(500).json({ message: 'Internal server error fetching chat history' });
  }
};

/**
 * Fetch message details for a single chat session
 */
export const getChatSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const chat = await Chat.findOne({ _id: id, userId: req.user.id });

    if (!chat) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    return res.status(200).json({ chat });
  } catch (error) {
    console.error('Fetch chat session error:', error);
    return res.status(500).json({ message: 'Internal server error fetching chat session' });
  }
};

/**
 * Delete a chat session
 */
export const deleteChat = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;
    const deletedChat = await Chat.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deletedChat) {
      return res.status(404).json({ message: 'Chat session not found or unauthorized' });
    }

    return res.status(200).json({ message: 'Chat session deleted successfully' });
  } catch (error) {
    console.error('Delete chat error:', error);
    return res.status(500).json({ message: 'Internal server error deleting chat' });
  }
};
