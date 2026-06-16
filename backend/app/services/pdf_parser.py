from io import BytesIO
from pypdf import PdfReader
from typing import List, Dict, Any

def parse_pdf_pages(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses PDF bytes page-by-page and extracts text.
    Returns a list of dicts: [{"page_number": 1, "text": "..."}]
    """
    pages = []
    try:
        reader = PdfReader(BytesIO(file_bytes))
        for index, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages.append({
                    "page_number": index + 1,
                    "text": text.strip()
                })
    except Exception as error:
        print(f"Error extracting PDF: {error}")
        raise ValueError(f"Failed to read PDF content: {str(error)}")
        
    return pages
