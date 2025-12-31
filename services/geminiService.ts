
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
  // Initialize the Google GenAI client inside the function as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Construct a concise summary of the organization state for the AI
  const contextSummary = `
CURRENT USER: ${context.currentUser.name} (Role: ${context.currentUser.role}, Dept ID: ${context.currentUser.departmentId || 'N/A'})

ORGANIZATION DATA:
- Employees: ${context.employees.map(e => `${e.firstName} ${e.lastName} (Role: ${e.role}, Dept: ${e.department}, Status: ${e.status})`).join(', ')}
- Leave Types: ${context.leaveTypes.map(t => `${t.name}: ${t.days} days allocation`).join(', ')}
- Upcoming Holidays: ${context.holidays.map(h => `${h.name} on ${h.date}`).join(', ')}
- Recent Leaves: ${context.leaves.slice(0, 10).map(l => `${l.userName} for ${l.type} from ${l.startDate} to ${l.endDate} (${l.status})`).join('; ')}
`;

  // Explicitly typing the response for compliance with guidelines
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: message,
    config: {
      systemInstruction: `You are the EmpowerCorp Intelligent HR Assistant. 
You have access to the real-time state of the HR Portal.
Rules:
1. Use the provided context to answer questions about specific employees, policies, or schedules.
2. If asked about leave balances, look at the leave types and approved leaves in the context.
3. Be professional, helpful, and concise.
4. Privacy: Only share sensitive details like salary if the current user is 'HR Manager'. For standard employees, keep information to roles, departments, and public schedules.
5. If the data is not in the context, say "I don't have information on that in our current records."
6. The current date is ${new Date().toLocaleDateString()}.

Context Snapshot:
${contextSummary}`,
    }
  });
  
  // Directly accessing .text property as per guidelines
  return response.text || "I'm sorry, I couldn't generate a response. Please try again.";
};

export const resetChatSession = () => {
  // Session is maintained by the model instructions and chat history in the component
};
