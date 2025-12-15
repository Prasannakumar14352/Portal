
import { Configuration, PopupRequest } from "@azure/msal-browser";

// --- AZURE APP CONFIGURATION ---
// Config is now loaded from .env variables
const CLIENT_ID = process.env.VITE_AZURE_CLIENT_ID ; // Fallback to provided ID
const TENANT_ID = process.env.VITE_AZURE_TENANT_ID ; // Fallback to provided ID

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
