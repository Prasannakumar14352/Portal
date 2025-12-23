
/**
 * Service to interact with Microsoft Graph API
 */

export interface AzureUser {
  id: string;
  displayName: string;
  givenName: string;
  surname: string;
  mail: string;
  userPrincipalName: string;
  jobTitle: string;
  department: string;
  accountEnabled: boolean;
}

export const microsoftGraphService = {
  /**
   * Fetches active users from the tenant
   * @param accessToken Valid MSAL access token with User.Read.All scope
   */
  fetchActiveUsers: async (accessToken: string): Promise<AzureUser[]> => {
    const endpoint = "https://graph.microsoft.com/v1.0/users?$filter=accountEnabled eq true&$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,accountEnabled";
    
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to fetch users from Azure");
    }

    const data = await response.json();
    return data.value as AzureUser[];
  }
};
