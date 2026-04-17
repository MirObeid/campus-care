import { GoogleGenAI } from "@google/genai";

// Standard way to access Gemini API key in this environment
const apiKey = process.env.GEMINI_API_KEY;

// Initialize AI
const ai = new GoogleGenAI({
  apiKey: apiKey || ''
});

export interface ChatMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

/**
 * Multi-turn chat with Gemini
 */
export async function chatWithGemini(userMessage: string, history: any[] = []) {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }

  try {
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: userMessage }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: contents,
      config: {
        systemInstruction: `You are the "Campus Care Assistant", a friendly and helpful AI guide for a university campus complaint platform. 
        Your goals:
        1. Help students understand how to use the platform.
        2. If a student describes a specific problem (like broken lights, leaking pipes, etc.), encourage them to report it using the "New Report" button in their portal.
        3. Provide general campus guidance and answer questions politely.
        4. Maintain a supportive, professional, yet approachable tone.
        5. If someone asks offensive or harmful questions, politely decline and steer back to campus-related topics.`,
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("The AI returned an empty response.");
    }

    return responseText;
  } catch (error: any) {
    console.error("Chat with Gemini failed:", error);
    throw error;
  }
}
