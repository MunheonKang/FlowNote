import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { noteText } = req.body;
    
    // Server-side environment variable
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다 (GEMINI_API_KEY).' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-flash-lite-latest",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 500,
      }
    });

    const prompt = `
      You are a productivity assistant. 
      Analyze the following user note and perform two tasks:
      1. Categorize it into one short category (e.g., Todo, Idea, Meeting, Personal, Bug, etc.)
      2. Translate the entire note into natural English.

      Output ONLY a valid JSON object with exact keys "category" and "translation".
      User note:
      "${noteText}"
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    return res.status(200).json({ result: text });
  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
