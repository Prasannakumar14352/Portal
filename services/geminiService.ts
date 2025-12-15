
import { GoogleGenAI } from "@google/genai";

// Initialize the Google GenAI client
// The API key is assumed to be available in the environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getHRChatResponse = async (message: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: "You are a helpful and professional HR Assistant for EmpowerCorp. You help employees with questions about leave policies, holidays, benefits, and general HR queries. Keep answers concise and friendly.",
      }
    });
    
    return response.text || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("AI Service Error:", error);
    return "Sorry, I am unable to process your request at the moment. Please ensure your API key is configured correctly.";
  }
};

export const resetChatSession = () => {
  // Client-side session management if needed, currently stateless
};
