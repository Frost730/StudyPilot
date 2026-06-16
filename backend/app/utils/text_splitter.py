import re
from typing import List, Dict, Any

def split_pages_into_chunks(
    pages: List[Dict[str, Any]], 
    chunk_size: int = 800, 
    chunk_overlap: int = 150
) -> List[Dict[str, Any]]:
    """
    Splits text page-by-page into overlapping text segments.
    Ensures text is split at sentence or word boundaries, preventing mid-word/mid-sentence cuts,
    which dramatically improves vector embedding semantic accuracy and retrieval quality.
    Retains page mappings for accurate RAG document citations.
    """
    chunks = []
    
    # Regular expression to split sentences while keeping punctuation (. ? !)
    sentence_endings = re.compile(r'(?<=[.!?])\s+')
    
    for page in pages:
        # Normalize whitespace (replace multiple spaces/newlines with single space)
        text = " ".join(page["text"].split())
        page_num = page["page_number"]
        
        if len(text) <= chunk_size:
            if len(text.strip()) > 10:
                chunks.append({
                    "content": text.strip(),
                    "page_number": page_num
                })
            continue
            
        sentences = sentence_endings.split(text)
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            # If a single sentence is larger than chunk_size, split it by words
            if len(sentence) > chunk_size:
                # Flush existing chunk
                if current_chunk:
                    chunks.append({
                        "content": " ".join(current_chunk),
                        "page_number": page_num
                    })
                    current_chunk = []
                    current_length = 0
                    
                words = sentence.split(" ")
                word_chunk = []
                word_len = 0
                for w in words:
                    if word_len + len(w) + (1 if word_chunk else 0) > chunk_size:
                        if word_chunk:
                            chunks.append({
                                "content": " ".join(word_chunk),
                                "page_number": page_num
                            })
                        word_chunk = [w]
                        word_len = len(w)
                    else:
                        word_chunk.append(w)
                        word_len += len(w) + (1 if len(word_chunk) > 1 else 0)
                if word_chunk:
                    current_chunk = word_chunk
                    current_length = word_len
            else:
                # If adding the sentence exceeds chunk_size, flush and start a new one with overlap
                if current_length + len(sentence) + (1 if current_chunk else 0) > chunk_size:
                    if current_chunk:
                        chunks.append({
                            "content": " ".join(current_chunk),
                            "page_number": page_num
                        })
                    
                    # Create sentence-level overlap fitting in chunk_overlap
                    overlap_chunk = []
                    overlap_len = 0
                    for prev_sent in reversed(current_chunk):
                        if overlap_len + len(prev_sent) + (1 if overlap_chunk else 0) <= chunk_overlap:
                            overlap_chunk.insert(0, prev_sent)
                            overlap_len += len(prev_sent) + (1 if len(overlap_chunk) > 1 else 0)
                        else:
                            break
                    
                    current_chunk = overlap_chunk
                    current_length = overlap_len
                
                current_chunk.append(sentence)
                current_length += len(sentence) + (1 if len(current_chunk) > 1 else 0)
                
        if current_chunk:
            chunks.append({
                "content": " ".join(current_chunk),
                "page_number": page_num
            })
            
    return chunks
