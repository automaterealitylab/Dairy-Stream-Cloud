const axios = require("axios");
require("dotenv").config(); // Essential to access process.env.KICKBOX_API_KEY

const verifyEmail = async (email) => {
    
    try {
        const response = await axios.get("https://api.kickbox.com/v2/verify", {
            params: {
                email: email,
                apikey: process.env.KICKBOX_API_KEY,
            },
        });

        const data = response.data;
        console.log("Kickbox response:", data.result);

        const isValid = data.result === "deliverable" && !data.disposable && !data.accept_all;
        
        return isValid;
    } catch (error) {
        console.error("Kickbox verification error:", error.message);
        return false;
    }
};

module.exports = verifyEmail;