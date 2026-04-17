import { GoogleGenAI, Type } from "@google/genai";
import { ComplaintPriority } from "../types";

// Standard way to access Gemini API key in this environment
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface AdminAISummary {
  summary: string;
  suggestedAction: string;
  severity: ComplaintPriority;
}

/**
 * Isolated AI feature for Admin Panel: summarizes complaints and suggests actions
 */
export async function getAdminComplaintSummary(description: string, category: string): Promise<AdminAISummary> {
  if (!apiKey) {
    throw new Error("AI unavailable: Missing API key");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `
        You are an administrative assistant for a university campus. 
        Analyze the following complaint and provide a professional summary and a practical suggested action for the staff/admin.

        Complaint Category: ${category}
        Original Description: "${description}"

        Return the response in JSON format.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "A concise 1-2 sentence summary of the issue.",
            },
            suggestedAction: {
              type: Type.STRING,
              description: "A professional recommendation for the next step (e.g., 'Deploy security team', 'Contact plumbing maintenance').",
            },
            severity: {
              type: Type.STRING,
              enum: ["Low", "Medium", "High", "Critical"],
              description: "The assessed severity of the situation.",
            }
          },
          required: ["summary", "suggestedAction", "severity"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(text);
    return {
      summary: parsed.summary,
      suggestedAction: parsed.suggestedAction,
      severity: parsed.severity as ComplaintPriority
    };

  } catch (error) {
    console.error("Admin AI summary failed:", error);
    throw error;
  }
}
