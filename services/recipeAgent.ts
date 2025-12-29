
import { GoogleGenAI, Tool, FunctionDeclaration, Type, GenerateContentResponse } from "@google/genai";
import { getSettings } from "./storage";
import { ChatMessage } from "../types";

// --- 1. THE KNOWLEDGE BASE (Mock Database) ---
const RECIPE_DB = [
    {
        id: "rec_1",
        name: "Classic Carbonara",
        ingredients: ["Spaghetti", "Guanciale or Pancetta", "Eggs (yolks)", "Pecorino Romano", "Black Pepper"],
        steps: "1. Boil pasta. 2. Fry guanciale until crisp. 3. Whisk yolks with cheese and pepper. 4. Mix hot pasta with guanciale fat, then remove from heat and mix in egg mixture quickly to create sauce.",
        tags: ["italian", "pasta", "quick"]
    },
    {
        id: "rec_2",
        name: "Spicy Tuna Crispy Rice",
        ingredients: ["Sushi Rice", "Fresh Tuna", "Sriracha", "Mayo", "Sesame Oil", "Jalapeno", "Cooking Oil"],
        steps: "1. Cook sushi rice and compress into rectangle. Cool. 2. Cut into blocks and fry until golden. 3. Dice tuna, mix with spicy mayo (sriracha+mayo+sesame oil). 4. Top crispy rice with tuna and jalapeno slice.",
        tags: ["japanese", "appetizer", "fish"]
    },
    {
        id: "rec_3",
        name: "Avocado Toast with Poached Egg",
        ingredients: ["Sourdough Bread", "Ripe Avocado", "Egg", "Vinegar", "Chili Flakes", "Lemon"],
        steps: "1. Toast bread. 2. Mash avocado with lemon and salt. 3. Poach egg in simmering water with splash of vinegar for 3 mins. 4. Assemble and top with chili flakes.",
        tags: ["breakfast", "vegetarian"]
    }
];

// --- 2. THE TOOL (Act) ---
const searchRecipes = (query: string) => {
    console.log(`[RecipeAgent] Searching for: ${query}`);
    const lowerQ = query.toLowerCase();
    
    const results = RECIPE_DB.filter(r => 
        r.name.toLowerCase().includes(lowerQ) || 
        r.ingredients.some(i => i.toLowerCase().includes(lowerQ)) ||
        r.tags.some(t => t.toLowerCase().includes(lowerQ))
    );

    if (results.length === 0) return "No specific recipes found in database. Suggest general cooking knowledge.";
    return JSON.stringify(results);
};

// Tool Definition for Gemini
const recipeTool: Tool = {
    functionDeclarations: [{
        name: "search_recipes",
        description: "Search the internal database for specific recipes, ingredients, or instructions.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: "The food item, ingredient, or cuisine to search for." }
            },
            required: ["query"]
        }
    }]
};

// --- 3. THE AGENT RUNNER (ReAct Loop) ---

export interface RecipeAgentResponse {
    text: string;
    usedRetrieval: boolean;
    reasoning: string;
}

export const runRecipeAgent = async (
    history: ChatMessage[], 
    currentMessage: string
): Promise<RecipeAgentResponse> => {
    const settings = getSettings();
    // Correctly obtain API key from environment
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `
    You are a Specialized Recipe Agent.
    
    PROTOCOL (ReAct):
    1. **REASON**: Analyze the user's request. Do you have the specific recipe details in your chat history context? Or do you need to look it up?
    2. **ACT**: If you need details, call \`search_recipes\`. If it's chit-chat or you already know (e.g. follow-up question), skip to Respond.
    3. **OBSERVE**: Use the tool result.
    4. **RESPOND**: Answer the user.

    OUTPUT FORMAT:
    You are friendly and helpful. If you looked up a recipe, mention that you found it in the database.
    `;

    let usedRetrieval = false;
    let reasoning = "Direct Answer (Memory/General Knowledge)";

    try {
        // Correct initialization of chat and query with tools
        const chat = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: { 
                systemInstruction, 
                tools: [recipeTool] 
            },
            history: history.map(m => ({ 
                role: m.role === 'model' ? 'model' : 'user', 
                parts: [{ text: m.content }] 
            }))
        });

        // 1. Send Message - must use named parameter 'message'
        let response = await chat.sendMessage({ message: currentMessage });
        
        // 2. Check for Function Calls via .functionCalls property
        const functionCalls = response.functionCalls;
        
        if (functionCalls && functionCalls.length > 0) {
            usedRetrieval = true;
            const call = functionCalls[0];
            reasoning = `Retrieval Triggered: Searching for "${call.args['query']}"`;
            
            // 3. Execute Tool (Act)
            const apiResult = searchRecipes(call.args['query'] as string);
            
            // 4. Send Result back to Model (Observe) - must use named parameter 'message'
            const finalResult = await chat.sendMessage({
                message: [
                    {
                        functionResponse: {
                            name: call.name,
                            id: call.id,
                            response: { result: apiResult }
                        }
                    }
                ]
            });
            
            return {
                text: finalResult.text || "I found something but can't explain it.",
                usedRetrieval: true,
                reasoning: reasoning
            };
        }

        // No tool called -> Direct response
        return {
            text: response.text || "Acknowledged.",
            usedRetrieval: false,
            reasoning: "Reasoning: Sufficient context in history or general chit-chat."
        };

    } catch (e: any) {
        console.error("Recipe Agent Failed", e);
        return {
            text: "I burned the sauce. (System Error: " + e.message + ")",
            usedRetrieval: false,
            reasoning: "Error encountered."
        };
    }
};
