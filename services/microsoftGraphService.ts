
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
  employeeId: string;
  employeeHireDate: string;
  accountEnabled: boolean;
}

export const microsoftGraphService = {
  /**
   * Fetches active users from the tenant for bulk sync
   */
  fetchActiveUsers: async (accessToken: string): Promise<AzureUser[]> => {
    const endpoint = "https://graph.microsoft.com/v1.0/users?$filter=accountEnabled eq true&$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,employeeId,employeeHireDate,accountEnabled";
    
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
  },

  /**
   * Fetches the detailed profile of the current logged-in user
   */
  fetchMe: async (accessToken: string): Promise<Partial<AzureUser>> => {
    const endpoint = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,employeeId,employeeHireDate";
    
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to profile from Azure");
    }

    return await response.json();
  },

  /**
   * Updates an existing user in the Azure Portal
   * Requires User.ReadWrite.All
   */
  updateUser: async (accessToken: string, userPrincipalName: string, data: any): Promise<void> => {
    const endpoint = `https://graph.microsoft.com/v1.0/users/${userPrincipalName}`;
    
    // Construct payload based on local employee fields
    const body: any = {};
    if (data.department) body.department = data.department;
    if (data.position || data.jobTitle) body.jobTitle = data.position || data.jobTitle;
    if (data.firstName) body.givenName = data.firstName;
    if (data.lastName) body.surname = data.lastName;
    if (data.firstName && data.lastName) body.displayName = `${data.firstName} ${data.lastName}`;
    if (data.employeeId) body.employeeId = String(data.employeeId);

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Azure Update Failed");
    }
  },

  /**
   * Creates a new user in the Azure Portal
   * Requires User.ReadWrite.All
   */
  createUser: async (accessToken: string, userData: any): Promise<any> => {
    const endpoint = "https://graph.microsoft.com/v1.0/users";
    
    const body = {
      accountEnabled: true,
      displayName: `${userData.firstName} ${userData.lastName}`,
      mailNickname: userData.firstName.toLowerCase(),
      userPrincipalName: userData.email,
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: userData.password || "TempPass123!"
      },
      jobTitle: userData.jobTitle || userData.position,
      department: userData.department,
      employeeId: String(userData.employeeId),
      givenName: userData.firstName,
      surname: userData.lastName
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Azure Provisioning Failed");
    }

    return await response.json();
  }
};
