
import { Configuration, PopupRequest } from "@azure/msal-browser";

// --- AZURE APP CONFIGURATION ---
const CLIENT_ID = process.env.VITE_AZURE_CLIENT_ID || "af84ee21-88c6-4cb7-9586-957230a8f583";
const TENANT_ID = process.env.VITE_AZURE_TENANT_ID || "e917b365-0776-4fcc-b8f6-5c12396474e0";

export const msalConfig: Configuration = {
    auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "localStorage", 
        storeAuthStateInCookie: true,
    }
};

export const loginRequest: PopupRequest = {
    // Added User.ReadWrite.All for provisioning capabilities
    scopes: ["User.Read", "User.Read.All", "User.ReadWrite.All"],
    prompt: "select_account"
};
