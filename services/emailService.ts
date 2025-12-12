// This service simulates an email server. 
// In a real application, this would call a backend API (e.g., SendGrid, AWS SES).

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

export const emailService = {
  sendEmail: async (payload: EmailPayload): Promise<boolean> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Log the email to the console to demonstrate it works
    console.group('📧 [MOCK EMAIL SENT]');
    console.log(`To: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`Body: ${payload.body}`);
    console.groupEnd();

    return true;
  }
};