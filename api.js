require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Environment variables
const DISCORD_BOT_TOKEN = process.env.TOKEN;
const GUILD_ID = "1325850250027597845";
const TARGET_ROLE_ID = "1325853699087536228";

// Logging middleware for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Root endpoint for testing
app.get("/", (req, res) => {
    res.json({
        message: "Discord Role Check API",
        endpoints: [
            "GET /health - Health check",
            "POST /api/check-role - Standard role check",
            "POST /api/botghost-check-role - BotGhost compatible",
            "GET /api/botghost-check-role - BotGhost GET method",
            "POST /webhook - Generic webhook endpoint"
        ],
        timestamp: new Date().toISOString()
    });
});

// Standard role check function
async function checkDiscordRole(userId) {
    console.log(`Checking role for user: ${userId}`);
    
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
            return { success: false, error: `Discord API error: ${response.status}`, details: errorText };
        }
        
        const userData = await response.json();
        const hasRole = userData.roles.includes(TARGET_ROLE_ID);
        
        console.log(`User ${userId} has target role: ${hasRole}`);
        console.log('User roles:', userData.roles);
        
        return { success: true, hasRole, userData };
    } catch (error) {
        console.error("Error checking role:", error);
        return { success: false, error: error.message };
    }
}



// Universal endpoint that handles both GET and POST for maximum BotGhost compatibility
app.all("/api/check-role", async (req, res) => {
    console.log(`${req.method} request to /api/check-role:`);
    console.log("Headers:", req.headers);
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Query:", req.query);
    
    // Extract user ID from all possible locations
    let userId = null;
    
    // From query parameters (GET requests)
    userId = req.query.userId || req.query.user_id || req.query.discord_id || req.query.member_id || req.query.id;
    
    // From request body (POST requests)
    if (!userId) {
        userId = req.body.userId || req.body.user_id || req.body.discord_id || req.body.member_id || req.body.id || req.body.discordUserId;
    }
    
    // From nested objects (various webhook formats)
    if (!userId && req.body.user) {
        userId = req.body.user.id || req.body.user.userId || req.body.user.discord_id;
    }
    
    if (!userId && req.body.member) {
        userId = req.body.member.id || req.body.member.userId || req.body.member.user?.id;
    }
    
    // Discord webhook format
    if (!userId && req.body.author) {
        userId = req.body.author.id;
    }
    
    // BotGhost might send as form data
    if (!userId && req.body.data) {
        try {
            const data = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
            userId = data.userId || data.user_id || data.discord_id || data.id;
        } catch (e) {
            console.log("Failed to parse data field:", e.message);
        }
    }
    
    if (!userId) {
        console.log("No userId found in request");
        return res.json({ 
            success: false, 
            hasRole: false,
            error: "User ID is required",
            message: "Please provide userId in query params or request body",
            receivedData: {
                method: req.method,
                body: req.body,
                query: req.query,
                contentType: req.headers['content-type']
            }
        });
    }
    
    console.log(`Found userId: ${userId}`);
    
    const result = await checkDiscordRole(userId);
    
    if (!result.success) {
        return res.json({
            success: false,
            hasRole: false,
            error: result.error,
            message: result.error,
            details: result.details
        });
    }
    
    // Return multiple formats for maximum compatibility
    const response = {
        // Standard format
        success: true,
        hasRole: result.hasRole,
        
        // Alternative formats
        roleFound: result.hasRole,
        authorized: result.hasRole,
        result: result.hasRole ? "true" : "false",
        status: result.hasRole ? "success" : "failed",
        access: result.hasRole ? "granted" : "denied",
        
        // Metadata
        userId: userId,
        guildId: GUILD_ID,
        roleId: TARGET_ROLE_ID,
        timestamp: new Date().toISOString(),
        method: req.method
    };
    
    console.log("Sending response:", response);
    res.json(response);
