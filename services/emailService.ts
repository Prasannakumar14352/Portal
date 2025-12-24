
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
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Log the email to the console to demonstrate it works
    console.group('📧 [HR PORTAL EMAIL SENT]');
    console.log(`To: ${payload.to}`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`--- Content Start ---`);
    console.log(payload.body);
    console.log(`--- Content End ---`);
    console.groupEnd();

    return true;
  },

  sendInvitation: async (data: { email: string, firstName: string, role: string, token: string }): Promise<boolean> => {
    const acceptLink = `${window.location.origin}/accept-invite?token=${data.token}`;
    
    const body = `
      Hello ${data.firstName},

      Welcome to EmpowerCorp! You have been invited to join our HR Portal as a ${data.role}.

      To complete your registration and set up your account, please click the link below:
      ${acceptLink}

      Note: This link will expire in 48 hours.

      If you have any questions, please contact our HR department.

      Best regards,
      The EmpowerCorp Onboarding Team
    `;

    return emailService.sendEmail({
      to: data.email,
      subject: `Invitation to join EmpowerCorp HR Portal`,
      body: body
    });
  }
};
