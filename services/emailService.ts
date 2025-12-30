
/**
 * Note: Actual email delivery is now handled by the Node.js backend
 * via the POST /api/invitations endpoint using SMTP.
 */

export const emailService = {
  sendInvitation: async (data: { email: string, firstName: string, role: string, token: string }): Promise<boolean> => {
    // The frontend simply logs that it initiated the process. 
    // The real work happens in contexts/AppContext.tsx when it calls the API.
    console.log(`[Email Service] Invitation process initiated for ${data.email}. Backend will deliver via SMTP.`);
    return true;
  }
};
