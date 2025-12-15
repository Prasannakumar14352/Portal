
import { Configuration, PopupRequest } from "@azure/msal-browser";

// Config derived from provided screenshot
export const msalConfig: Configuration = {
    auth: {
        clientId: "af84ee21-88c6-4cb7-9586-957230a8f583",
        authority: "https://login.microsoftonline.com/e917b365-0776-4fcc-b8f6-5c12396474e0",
        redirectUri: window.location.origin, // e.g., http://localhost:5173
        navigateToLoginRequestUrl: false, // Recommended for SPAs to avoid redirect loops
    },
    cache: {
        cacheLocation: "sessionStorage", 
        storeAuthStateInCookie: false,
    }
};

export const loginRequest: PopupRequest = {
    scopes: ["User.Read"],
    prompt: "select_account" // Forces account selection to avoid stale session loops
};
