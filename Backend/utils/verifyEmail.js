import axios from "axios";
import "../config/loadEnv.js";

// Load env vars (Just in case this file is run standalone)

const verifyEmail = async (email) => {
    // If no API key is set, skip verification (Dev mode safety)
    if (!process.env.KICKBOX_API_KEY) {
        console.warn("⚠️ Kickbox API Key missing. Skipping email verification.");
        return true; 
    }

    try {
        const response = await axios.get("https://api.kickbox.com/v2/verify", {
            params: {
                email: email,
                apikey: process.env.KICKBOX_API_KEY,
            },
        });

        const data = response.data;
        console.log("Kickbox result:", data.result);

        // Strict Check: Must be deliverable, not disposable, and not a "catch-all"
        const isValid = 
            data.result === "deliverable" && 
            !data.disposable && 
            !data.accept_all;
        
        return isValid;

    } catch (error) {
        console.error("Kickbox verification error:", error.message);
        // DECISION: If the API fails, do we block the user (return false) or let them in (return true)?
        // Currently returning 'false' means if Kickbox is down, nobody can sign up.
        return false; 
    }
};

export default verifyEmail;
