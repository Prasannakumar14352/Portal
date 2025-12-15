
export const getHRChatResponse = async (message: string): Promise<string> => {
  try {
    const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    
    if (!response.ok) throw new Error("Backend error");
    
    const data = await response.json();
    return data.response;
  } catch (error) {
    return "Sorry, I am unable to connect to the HR server at the moment. Please ensure the backend is running.";
  }
};

export const resetChatSession = () => {
  // No session state needed for simple REST API
};
