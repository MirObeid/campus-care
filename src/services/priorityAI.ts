import { GoogleGenAI, Type } from "@google/genai";
import { ComplaintPriority } from "../types";

/**
 * Keyword-based fallback priority detection
 */
const detectPriorityByKeywords = (description: string): ComplaintPriority => {
  const text = description.toLowerCase();

  // Critical issues
  if (
    text.includes("fire") ||
    text.includes("accident") ||
    text.includes("emergency") ||
    text.includes("injury") ||
    text.includes("gas leak")
  ) {
    return "Critical";
  }

  // High priority issues
  if (
    text.includes("theft") ||
    text.includes("stolen") ||      // ✅ FIXED
    text.includes("robbery") ||
    text.includes("harassment") ||
    text.includes("security") ||
    text.includes("violence") ||
    text.includes("attack")
  ) {
    return "High";
  }

  // Medium priority issues
  if (
    text.includes("broken") ||
    text.includes("leak") ||
    text.includes("electricity") ||
    text.includes("power") ||
    text.includes("water") ||
    text.includes("ac") ||
    text.includes("fan")
  ) {
    return "Medium";
  }

  return "Low";
};

/**
 * AI-powered priority detection (isolated from chatbot)
 */
export async function detectComplaintPriority(
  description: string
): Promise<{ priority: ComplaintPriority }> {

  // ✅ UNIVERSAL API KEY (AI Studio + Vite)
  const apiKey = process.env.GEMINI_API_KEY;

  // 🔁 Fallback if no key
  if (!apiKey) {
    console.warn("⚠️ Missing Gemini API key → using fallback");
    return { priority: detectPriorityByKeywords(description) };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: `
You are a campus safety and facility management expert.

Analyze this complaint and return ONLY JSON:

{ "priority": "Low" | "Medium" | "High" | "Critical" }

Rules:
- Critical → fire, emergency, life-threatening
- High → theft, stolen items, harassment, security threats
- Medium → maintenance issues
- Low → minor issues

Complaint: "${description}"
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              enum: ["Low", "Medium", "High", "Critical"],
            },
          },
          required: ["priority"],
        },
      },
    });

    const text = response.text;

    if (!text) {
      return { priority: detectPriorityByKeywords(description) };
    }

    // ✅ SAFE JSON PARSING (IMPORTANT FIX)
    try {
      const match = text.match(/\{[\s\S]*\}/);

      if (!match) {
        throw new Error("Invalid JSON format");
      }

      const parsed = JSON.parse(match[0]);

      if (
        parsed.priority &&
        ["Low", "Medium", "High", "Critical"].includes(parsed.priority)
      ) {
        return { priority: parsed.priority as ComplaintPriority };
      }
    } catch (parseError) {
      console.error("❌ JSON parse failed:", text);
    }

    // 🔁 fallback if AI gives bad response
    return { priority: detectPriorityByKeywords(description) };

  } catch (error) {
    console.error("❌ AI Priority detection failed:", error);
    return { priority: detectPriorityByKeywords(description) };
  }
}