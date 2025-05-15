require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For handling form data

// Environment variables
const DISCORD_BOT_TOKEN = process.env.TOKEN;
const GUILD_ID = "1325850250027597845";
const TARGET_ROLE_ID = "1325853699087536228";

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.options("/api/check-role", cors());

// Enhanced endpoint that accepts different parameter formats
app.post("/api/check-role", async (req, res) => {
    console.log("Received Request Body:", req.body);
    console.log("Request Headers:", req.headers);
    
    // Extract userId from various possible places
    const userId = req.body.userId || req.body.user_id || req.body.discordId || req.query.userId;
    
    if (!userId) {
        return res.status(400).json({ 
            error: "User ID is required",
            receivedBody: req.body,
            help: "Please provide a userId parameter in the request body or query string"
        });
    }
    
    console.log(`Checking role for user: ${userId}`);
    console.log(`Fetching: https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`);
    
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
        });
        
        console.log("Discord API Response Status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Discord API Error:", {
                status: response.status,
                body: errorText
            });
            
            // Return more detailed error message
            return res.status(response.status).json({
                error: "Discord API request failed",
                status: response.status,
                discordMessage: errorText,
                possibleIssues: [
                    "Invalid user ID",
                    "User not in server",
                    "Bot token lacks permissions",
                    "Discord API rate limit"
                ]
            });
        }
        
        const userData = await response.json();
        const hasRole = userData.roles.includes(TARGET_ROLE_ID);
        
        console.log(`User ${userId} has target role: ${hasRole}`);
        
        // Return more useful response
        res.json({ 
            hasRole,
            userId,
            guildId: GUILD_ID,
            roleId: TARGET_ROLE_ID
        });
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ 
            error: "Internal server error", 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// BotGhost compatibility endpoint (they might expect a different format)
app.post("/api/botghost-check-role", async (req, res) => {
    console.log("BotGhost Request Body:", req.body);
    
    // BotGhost might send data differently
    const userId = req.body.userId || req.body.user_id || req.body.discord_id || req.body.member_id;
    
    if (!userId) {
        return res.status(400).json({ success: false, message: "User ID is required" });
    }
    
    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json"
            },
        });
        
        if (!response.ok) {
            return res.json({
                success: false,
                hasRole: false,
                message: `Failed to get user data: ${response.status}`
            });
        }
        
        const userData = await response.json();
        const hasRole = userData.roles.includes(TARGET_ROLE_ID);
        
        // Format specifically for BotGhost
        res.json({ 
            success: true,
            hasRole,
            roleFound: hasRole // Alternative property name
        });
    } catch (error) {
        console.error("Server Error in BotGhost endpoint:", error);
        res.json({ 
            success: false,
            hasRole: false,
            message: error.message
        });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Discord Role Check Server running on port ${PORT}`);
    console.log(`🔗 Health check: http://narys.mielamalonu.com/health`);
    console.log(`📝 Server is configured to check for role ID: ${TARGET_ROLE_ID}`);
});
