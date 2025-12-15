
import { Configuration, PopupRequest } from "@azure/msal-browser";

// --- AZURE APP CONFIGURATION ---
// 1. Create a new App Registration in Azure Portal.
// 2. Select "Single-page application" (SPA) for the platform. Do NOT use "Web".
// 3. Add "http://localhost:5173" as the Redirect URI.
// 4. Paste your new IDs below:

const CLIENT_ID = "af84ee21-88c6-4cb7-9586-957230a8f583"; // Replace with your new Application (client) ID
const TENANT_ID = "e917b365-0776-4fcc-b8f6-5c12396474e0"; // Replace with your new Directory (tenant) ID

// -------------------------------

export const msalConfig: Configuration = {
    auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin, // e.g., http://localhost:5173
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "sessionStorage", 
        storeAuthStateInCookie: false,
    }
};

export const loginRequest: PopupRequest = {
    scopes: ["User.Read"],
    prompt: "select_account"
};
