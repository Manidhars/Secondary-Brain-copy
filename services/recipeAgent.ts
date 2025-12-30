
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

    return results;
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
    const results = searchRecipes(currentMessage);
    const usedRetrieval = results.length > 0;

    if (!usedRetrieval) {
        return {
            text: "I couldn't find that in the pantry. Try mentioning an ingredient or cuisine and I'll search again.",
            usedRetrieval: false,
            reasoning: "No recipe matched the query; prompting for clarification."
        };
    }

    const summary = results
        .slice(0, 3)
        .map(r => `• ${r.name}: ${r.steps.split('.')
            .slice(0, 2)
            .join('.')}...`)
        .join("\n");

    return {
        text: `Found ${results.length} recipe${results.length === 1 ? '' : 's'} that match: \n${summary}`,
        usedRetrieval,
        reasoning: `Queried local recipe memory for "${currentMessage}".`
    };
};
