import { GoogleGenerativeAI } from "@google/generative-ai";

export interface EnrichedItem {
    title: string;
    description?: string;
    tags: string[];
    imageVerifyQuery?: string;
    imageUrl?: string;
    location?: string; // Address or location for places
}

export async function enrichItems(rawItems: string[]): Promise<EnrichedItem[]> {
    // Initialize Gemini lazily to ensure env vars are loaded
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

    if (!apiKey) {
        console.error("[Enrichment Lib] CRITICAL: Missing Gemini API Key");
        return rawItems.map(t => ({ title: t, tags: [] }));
    }
    console.log(`[Enrichment Lib] Initializing with key: ${apiKey.substring(0, 4)}...`);

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log(`[Enrichment Lib] Enriching ${rawItems.length} items...`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
        You are a helpful assistant for a list-making app. 
        I will give you a list of items. Your job is to generate metadata for each item.
        
        For each item, provide:
        1. A corrected title (fix typos).
        2. A short description (1 sentence, max 20 words).
        3. 10-15 relevant tags.
           - CRITICAL: The FIRST tag MUST be one of these primary categories: "Movie", "TV Series", "Book", "Place", "Song", "Restaurant", "Product", "Person", "Event", "Accommodation", "Game", "Music Album".
           - The remaining tags should be specific genres, vibes, or descriptors.
        4. A specific search query to find a high-quality image (e.g. "The Matrix movie poster", "Inception film still").
        5. For places, restaurants, hotels, accommodations, or any physical location: include the full street address in the "location" field (e.g. "112 East 11th Street, New York, NY 10003"). For non-physical items like movies, books, or songs, leave location as null or empty.

        Return ONLY a JSON array of objects. Do not include markdown formatting.
        Format: [{
            "title": "Item Name", 
            "description": "Short text", 
            "tags": ["Tag1", "Tag2"], 
            "imageVerifyQuery": "Item Name poster",
            "location": "Full street address or null"
        }]

        Items:
        ${JSON.stringify(rawItems)}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("[Enrichment Lib] Gemini Raw Response:", text);

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, "").replace(/```/g, "").trim();

        let enrichedItems: EnrichedItem[] = [];
        try {
            enrichedItems = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse JSON from Gemini:", jsonStr);
            // Fallback: minimal structure
            enrichedItems = rawItems.map(t => ({ title: t, tags: [] }));
        }

        // Fetch Images using Google Custom Search
        const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
        const GOOGLE_CX = process.env.GOOGLE_SEARCH_ENGINE_ID;

        if (GOOGLE_SEARCH_API_KEY && GOOGLE_CX) {
            const imagePromises = enrichedItems.map(async (item) => {
                try {
                    const query = item.imageVerifyQuery || `${item.title} poster`;
                    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${GOOGLE_CX}&key=${GOOGLE_SEARCH_API_KEY}&searchType=image&num=1&safe=high`;

                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.items && data.items.length > 0) {
                            item.imageUrl = data.items[0].link;
                        }
                    } else {
                        console.error(`[Enrichment Lib] Image fetch failed: ${res.status}`);
                    }
                } catch (err) {
                    console.error(`Image fetch error for ${item.title}:`, err);
                }
                return item;
            });

            enrichedItems = await Promise.all(imagePromises);
        } else {
            console.warn("[Enrichment Lib] Missing Google Custom Search keys");
        }

        return enrichedItems;

    } catch (error) {
        console.error("[Enrichment Lib] Enrichment error:", error);
        return rawItems.map(t => ({ title: t, tags: [] }));
    }
}
