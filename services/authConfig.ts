
import { Configuration, PopupRequest, LogLevel } from "@azure/msal-browser";

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
    },
    system: {
        allowRedirectInIframe: true,
        loggerOptions: {
            loggerCallback: (level, message, containsPii) => {
                if (containsPii) return;
                
                // Suppress "window closed" errors as they represent user cancellation
                if (message.includes("window closed") || message.includes("user_cancelled")) {
                    return;
                }

                switch (level) {
                    case LogLevel.Error:
                        console.error("[MSAL]", message);
                        return;
                    case LogLevel.Info:
                        console.info("[MSAL]", message);
                        return;
                    case LogLevel.Verbose:
                        console.debug("[MSAL]", message);
                        return;
                    case LogLevel.Warning:
                        console.warn("[MSAL]", message);
                        return;
                }
            }
        }
    }
};

export const loginRequest: PopupRequest = {
    // Added User.ReadWrite.All for provisioning capabilities
    scopes: ["User.Read", "User.Read.All", "User.ReadWrite.All"]
    // Removed prompt: "select_account" to allow auto-selection via loginHint
};
