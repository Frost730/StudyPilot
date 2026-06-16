import pdfParse from 'pdf-parse';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export const parsePdfPages = async (pdfBuffer: Buffer): Promise<ParsedPage[]> => {
  const pages: ParsedPage[] = [];

  // Custom page render function to capture text per page index
  const pagerender = async (pageData: any): Promise<string> => {
    const textContent = await pageData.getTextContent();
    let lastY = -1;
    let text = '';

    for (const item of textContent.items) {
      if (lastY === item.transform[5] || lastY === -1) {
        text += item.str + ' ';
      } else {
        text += '\n' + item.str + ' ';
      }
      lastY = item.transform[5];
    }
    
    pages.push({
      pageNumber: pageData.pageIndex + 1,
      text: text.trim(),
    });

    return text;
  };

  const options = {
    pagerender,
  };

  await pdfParse(pdfBuffer, options);
  
  // Sort pages by page number to make sure order is correct
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
};
