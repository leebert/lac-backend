import { GoogleGenAI } from "@google/genai";
import { logApiCall } from "../config/logger.js";

let client;
function getClient() {
    if (!client) {
        client = new GoogleGenAI({});
    }
    return client;
}

export async function generate({
    systemPrompt,
    userPrompt,
    temperature = 0.3
}) {
    const geminiClient = getClient();
    const startTime = Date.now();
    
    try {
        const result = await geminiClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `${systemPrompt}\n\n${userPrompt}`,
            config: {
                temperature
            }
        });

        // Parse the response
        const text = result.candidates[0].content.parts[0].text;
        const usage = result.usageMetadata;
        const duration = Date.now() - startTime;

        // Log successful API call
        logApiCall({
            service: 'Gemini',
            operation: 'generateContent',
            duration,
            promptTokens: usage?.promptTokenCount,
            candidatesTokens: usage?.candidatesTokenCount,
            totalTokens: usage?.totalTokenCount,
            model: 'gemini-2.5-flash'
        });

        return {
            text,
            usage
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log failed API call
        logApiCall({
            service: 'Gemini',
            operation: 'generateContent',
            duration,
            model: 'gemini-2.5-flash',
            error
        });
        
        throw error;
    }
}