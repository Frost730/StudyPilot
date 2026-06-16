export interface TextChunk {
  content: string;
  pageNumber: number;
}

/**
 * Splits page-by-page text into overlapping chunks.
 * Chunking within each page ensures we maintain accurate page number citation mappings.
 */
export const splitPagesIntoChunks = (
  pages: { pageNumber: number; text: string }[],
  chunkSize: number = 800,
  chunkOverlap: number = 150
): TextChunk[] => {
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const text = page.text.replace(/\s+/g, ' '); // Clean excessive whitespace
    
    if (text.length <= chunkSize) {
      if (text.trim().length > 10) { // filter out extremely small/empty pages
        chunks.push({
          content: text.trim(),
          pageNumber: page.pageNumber,
        });
      }
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunkText = text.substring(start, end).trim();
      
      if (chunkText.length > 20) {
        chunks.push({
          content: chunkText,
          pageNumber: page.pageNumber,
        });
      }
      
      start += chunkSize - chunkOverlap;
      
      // Safety condition to prevent infinite loop if overlap >= size
      if (chunkSize <= chunkOverlap) {
        break;
      }
    }
  }

  return chunks;
};
