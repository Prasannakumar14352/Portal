
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

/**
 * Interface for the context data we pass to Gemini
 */
export interface HRContext {
  currentUser: any;
  employees: any[];
  leaves: any[];
  leaveTypes: any[];
  holidays: any[];
  attendance: any[];
}

export const getHRChatResponse = async (message: string, context: HRContext): Promise<string> => {
  // Check multiple common environment variable names for the key
  const apiKey = process.env.API_KEY || process.env.VITE_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("MISSING_API_KEY");
  }

  // Initialize the Google GenAI client inside the function
  const ai = new GoogleGenAI({ apiKey });

  // Construct a concise summary of the organization state for the AI
  const contextSummary = `
CURRENT USER: ${context.currentUser.name} (Role: ${context.currentUser.role}, Dept ID: ${context.currentUser.departmentId || 'N/A'})

ORGANIZATION DATA:
- Employees: ${context.employees.map(e => `${e.firstName} ${e.lastName} (Role: ${e.role}, Dept: ${e.department}, Status: ${e.status})`).join(', ')}
- Leave Types: ${context.leaveTypes.map(t => `${t.name}: ${t.days} days allocation`).join(', ')}
- Upcoming Holidays: ${context.holidays.map(h => `${h.name} on ${h.date}`).join(', ')}
- Recent Leaves: ${context.leaves.slice(0, 10).map(l => `${l.userName} for ${l.type} from ${l.startDate} to ${l.endDate} (${l.status})`).join('; ')}
`;

  try {
      // Explicitly typing the response for compliance with guidelines
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: message,
        config: {
          systemInstruction: `You are the EmpowerCorp Intelligent Assistant, powered by Google Gemini.

    Hybrid Capabilities:
    1. **HR Specialist**: You have real-time access to the organization's data (Context Snapshot below). Use this to answer questions about colleagues, leave balances, holidays, and company structure.
    2. **General AI**: You are also a fully capable general-purpose AI. You can answer questions about coding, history, science, math, or help draft content unrelated to HR.

    Rules:
    - **Prioritize Context**: If the user asks about "my leave", "Alice", or "holidays", look at the Context Snapshot first.
    - **General Knowledge**: If the user asks something NOT in the context (e.g., "Write a Python script", "Who is the CEO of Google?", "Draft a generic email"), answer it using your general knowledge. Do NOT say "I don't have information" for general topics.
    - **Privacy**: When answering HR questions, check the CURRENT USER's role. Only reveal sensitive data (salary, private phone) if the user is 'HR Manager' or 'Admin'. For standard employees, limit HR answers to roles, departments, and public schedules.
    - **Tone**: Professional, helpful, and concise.

    Context Snapshot:
    ${contextSummary}

    Current Date: ${new Date().toLocaleDateString()}`,
        }
      });
      
      // Directly accessing .text property as per guidelines
      return response.text || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error: any) {
      // Re-throw to be handled by the component
      throw error;
  }
};

export const resetChatSession = () => {
  // Session is maintained by the model instructions and chat history in the component
};
