import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are an expert HR Assistant for a company called "EmpowerCorp".
Your role is to assist HR managers and employees with tasks such as:
1. Drafting job descriptions.
2. Explaining standard HR policies (leave, attendance, code of conduct).
3. Writing professional emails for internal communication.
4. Analyzing summary data provided in the prompt.
5. Providing tips on employee engagement and conflict resolution.

Keep your tone professional, empathetic, and concise. 
If asked about specific private employee data that is not provided in the conversation context, politely refuse and explain you don't have access to the live database for privacy reasons.`;

let chatSession: Chat | null = null;

export const getHRChatResponse = async (message: string): Promise<string> => {
  try {
    if (!chatSession) {
      chatSession = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });
    }

    const result: GenerateContentResponse = await chatSession.sendMessage({ message });
    return result.text || "I apologize, I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error while processing your request. Please check your API key.";
  }
};

export const resetChatSession = () => {
  chatSession = null;
};