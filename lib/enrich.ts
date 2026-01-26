// Real API Integration for Content Enrichment
// Uses Google Knowledge Graph API, Google Custom Search API, and Gemini Flash 2.5

interface EnrichmentResult {
    description: string;
    imageUrl: string;
    link: string;
    location: string;
    tags: string[];
}

// Internal interface for Gemini's structured response
interface GeminiEnrichResult {
    description: string;
    imageHint: string;  // "AUTO_FETCH" | "CLEARBIT" | "" 
    link: string;
    location: string;
    tags: string[];
    domain?: string;    // For Clearbit lookups
}

export interface Candidate {
    id: string;
    name: string;
    description: string;
    detailedDescription: string;
    imageUrl: string;
    type: string;        // Display label (e.g. "TV Show")
    internalType: string; // Internal key (e.g. "tv show")
}

export async function searchCandidates(query: string): Promise<Candidate[]> {
    const apiKey = process.env.GOOGLE_KNOWLEDGE_GRAPH_API_KEY;
    if (!apiKey) return [];

    try {
        const url = `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&key=${apiKey}&limit=5&indent=True`;
        const res = await fetch(url);
        if (!res.ok) return [];

        const data = await res.json();
        if (!data.itemListElement) return [];

        // Process candidates in parallel with image validation
        const candidatePromises = data.itemListElement.map(async (item: any) => {
            const name = item.result.name;
            const rawTypes = Array.isArray(item.result['@type']) ? item.result['@type'] : [item.result['@type']];

            // Determines type (e.g. "TV Series")
            let type = "Thing";
            let displayType = "Unknown";

            for (const t of rawTypes) {
                if (KG_TYPE_MAPPING[t]) {
                    displayType = KG_TYPE_MAPPING[t];
                    // Capitalize first letter for display
                    displayType = displayType.charAt(0).toUpperCase() + displayType.slice(1);
                    type = KG_TYPE_MAPPING[t]; // Use mapped type for fetching
                    break;
                }
            }

            // Fallback type logic for display
            if (displayType === "Unknown" || displayType === "Thing") {
                const betterType = rawTypes.find((t: string) => t !== "Thing");
                if (betterType) {
                    displayType = betterType.replace(/([A-Z])/g, ' $1').trim();
                    type = displayType.toLowerCase();
                } else {
                    displayType = "Item";
                }
            }

            // Try to validate/find a good image using our specialized logic
            // This mirrors processEntity to ensure "Did you mean" images match Result images
            let validatedImage = "";

            // 1. Try Specialized (TMDB/Books) - Highest fidelity
            const specializedData = await fetchBestArtworkAndURL(name, type);
            if (specializedData.imageURL) {
                validatedImage = specializedData.imageURL;
            }

            // 2. Try Raw KG Image
            if (!validatedImage) {
                const rawImage = item.result.image?.contentUrl || item.result.image?.url;
                if (rawImage && await validateImageUrl(rawImage)) {
                    validatedImage = rawImage;
                }
            }

            // 3. Fallback: Type-Aware Custom Search
            if (!validatedImage) {
                // e.g. "11.22.63 tv show" instead of just "11.22.63"
                const searchTerm = name + (type !== "Thing" && type !== "thing" ? ` ${type}` : "");
                const searchImage = await fetchBetterImage(searchTerm);
                if (searchImage) {
                    validatedImage = searchImage;
                }
            }

            return {
                id: item.result['@id'],
                name: name,
                description: item.result.description || item.result.detailedDescription?.articleBody || "",
                detailedDescription: item.result.detailedDescription?.articleBody || "",
                imageUrl: validatedImage,
                type: displayType,
                internalType: type
            };
        });

        return Promise.all(candidatePromises);
    } catch (error) {
        console.error("Search candidates error:", error);
        return [];
    }
}

export async function enrichContent(query: string, entityId?: string, initialImageUrl?: string, overrideType?: string): Promise<EnrichmentResult | null> {
    try {
        // Step 1: Try Google Knowledge Graph API first
        let kgResult = null;
        if (entityId) {
            kgResult = await fetchFromKnowledgeGraphById(entityId, query, initialImageUrl, overrideType);
        }

        if (kgResult) {
            return kgResult;
        }

        // Step 2: Fallback to Gemini Flash 2.5 for general queries
        const geminiResult = await fetchFromGemini(query);

        if (geminiResult) {
            // Resolve imageHint to actual imageUrl
            let resolvedImageUrl = "";

            // 1. Try Specialized Fetchers (Movies, Books, Music) FIRST (prioritize over modal image)
            if (geminiResult.imageHint === "AUTO_FETCH") {
                const category = geminiResult.tags?.[0] || "Other";
                const details = await fetchBestArtworkAndURL(query, category);

                if (details.imageURL) {
                    resolvedImageUrl = details.imageURL;
                    if (!geminiResult.link && details.url) {
                        geminiResult.link = details.url;
                    }
                }
            }

            // 2. If no specialized image found, try modal image
            if (!resolvedImageUrl && initialImageUrl) {
                resolvedImageUrl = initialImageUrl;
            }

            // 3. Clearbit (if hint says so and we still need an image)
            if (!resolvedImageUrl && geminiResult.imageHint === "CLEARBIT" && geminiResult.domain) {
                const clearbitUrl = `https://logo.clearbit.com/${geminiResult.domain}`;
                if (await validateImageUrl(clearbitUrl)) {
                    resolvedImageUrl = clearbitUrl;
                } else {
                    const faviconUrl = `https://www.google.com/s2/favicons?sz=128&domain=${geminiResult.domain}`;
                    if (await validateImageUrl(faviconUrl)) {
                        resolvedImageUrl = faviconUrl;
                    }
                }
            }

            // 4. Fallback to Custom Search
            if (!resolvedImageUrl) {
                const searchImage = await fetchBetterImage(query);
                if (searchImage) {
                    resolvedImageUrl = searchImage;
                }
            }

            // Convert GeminiEnrichResult to EnrichmentResult
            return {
                description: geminiResult.description,
                imageUrl: resolvedImageUrl,
                link: geminiResult.link,
                location: geminiResult.location,
                tags: geminiResult.tags
            };
        }

        return null;
    } catch (error) {
        console.error("Enrichment error:", error);
        return null;
    }
}

async function fetchFromKnowledgeGraphById(entityId: string, originalQuery: string, initialImageUrl?: string, overrideType?: string): Promise<EnrichmentResult | null> {
    const apiKey = process.env.GOOGLE_KNOWLEDGE_GRAPH_API_KEY;
    if (!apiKey) return null;

    try {
        const url = `https://kgsearch.googleapis.com/v1/entities:search?ids=${encodeURIComponent(entityId)}&key=${apiKey}&limit=1&indent=True`;
        const res = await fetch(url);

        if (!res.ok) return null;

        const data = await res.json();
        if (!data.itemListElement || data.itemListElement.length === 0) return null;

        const entity = data.itemListElement[0].result;
        return processEntity(entity, originalQuery || entity.name, initialImageUrl, overrideType);
    } catch (error) {
        console.error("KG By ID error:", error);
        return null;
    }
}

async function processEntity(entity: any, query: string, explicitImage?: string, overrideType?: string): Promise<EnrichmentResult> {
    const description = entity.detailedDescription?.articleBody || entity.description || "";

    // Determine type for better fetching
    let type = "thing";

    // PRIORITY 1: Use Override Type (from user selection) if valid
    if (overrideType && overrideType !== "Thing" && overrideType !== "Unknown") {
        type = overrideType.toLowerCase();
        // Map common display types to internal types if needed
        if (type === "tv series") type = "tv show";
        if (type === "film") type = "movie";
    }
    // PRIORITY 2: Infer from Entity Types
    else if (entity["@type"]) {
        const types = Array.isArray(entity["@type"]) ? entity["@type"] : [entity["@type"]];
        for (const t of types) {
            if (KG_TYPE_MAPPING[t]) {
                type = KG_TYPE_MAPPING[t];
                break;
            }
        }
    }

    // Use Specialized Fetcher if applicable (TMDB, Books API, etc.)
    // This provides MUCH better images and specific URLs than generic search
    const specializedData = await fetchBestArtworkAndURL(entity.name || query, type);

    // Initial Image Candidates
    let finalImage = "";
    let finalLink = entity.detailedDescription?.url || entity.url || "";

    // 1. Try Explicit Image (from modal selection) - Highest Priority
    if (explicitImage && await validateImageUrl(explicitImage)) {
        finalImage = explicitImage;
    }

    // 2. Try Specialized Data (TMDB/Books/etc)
    if (!finalImage && specializedData.imageURL) {
        finalImage = specializedData.imageURL;
    }
    // Always prefer specialized link if valid (e.g. TMDB link vs Wikipedia)
    if (specializedData.url) {
        finalLink = specializedData.url;
    }

    // 3. Fallback: Refined Custom Search
    if (!finalImage) {
        // Append type to query for better context (e.g. "11.22.63 tv show")
        const searchTerm = (entity.name || query) + (type !== "thing" ? ` ${type}` : "");
        const betterImage = await fetchBetterImage(searchTerm);
        if (betterImage) {
            finalImage = betterImage;
        }
    }

    // 4. Last Resort: Knowledge Graph Image
    if (!finalImage) {
        const kgImage = entity.image?.contentUrl || entity.image?.url;
        if (kgImage && await validateImageUrl(kgImage)) {
            finalImage = kgImage;
        }
    }

    // Use Gemini to generate intelligent tags
    // Pass the TYPE context to Gemini so it knows "11.22.63" is the TV show, not book
    const contextDescription = `Type: ${type}. ${description}`;
    const geminiTags = await generateTagsWithGemini(entity.name || query, contextDescription);

    return {
        description,
        imageUrl: finalImage,
        link: finalLink,
        location: extractLocation(entity),
        tags: geminiTags || extractTags(entity)
    };
}

// Categories the user wants to enforce
const PRIMARY_TAGS = [
    "movie", "tv show", "book", "music", "restaurant", "bar", "place", "accommodation", "product"
];

const KG_TYPE_MAPPING: Record<string, string> = {
    "Movie": "movie",
    "TVSeries": "tv show",
    "TVEpisode": "tv show",
    "Book": "book",
    "MusicAlbum": "music",
    "MusicGroup": "music",
    "MusicRecording": "music",
    "Restaurant": "restaurant",
    "BarOrPub": "bar",
    "Place": "place",
    "City": "place",
    "Country": "place",
    "AdministrativeArea": "place",
    "LandmarksOrHistoricalBuildings": "place",
    "TouristAttraction": "place",
    "LocalBusiness": "place", // fallback
    "Hotel": "accommodation",
    "LodgingBusiness": "accommodation",
    "Product": "product",
    "VideoGame": "video game",
    "Corporation": "company",
    "Organization": "company",
    "Person": "person",
    "Event": "event",
    "SportsTeam": "sports team"
};

async function validateImageUrl(url: string): Promise<boolean> {
    if (!url) return false;
    try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(2000) });
        return res.ok;
    } catch (e) {
        console.warn(`[ImageValidation] Failed to validate ${url}:`, e);
        return false;
    }
}

async function fetchBetterImage(query: string): Promise<string | null> {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY; // Explicitly use the Custom Search key
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
        console.warn("Google Custom Search not configured (need GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID)");
        return null;
    }

    try {
        // Refine query to get better images
        const refinedQuery = `${query} high quality`;
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(refinedQuery)}&cx=${searchEngineId}&searchType=image&num=1&key=${apiKey}&imgSize=large&safe=active`;

        console.log(`[CustomSearch] Fetching image for: ${refinedQuery}`);

        const res = await fetch(url);

        if (!res.ok) {
            console.warn(`[CustomSearch] API error: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.warn(`[CustomSearch] Response: ${text}`);
            return null;
        }

        const data = await res.json();
        if (data.items && data.items.length > 0) {
            const imageUrl = data.items[0].link;
            console.log(`[CustomSearch] Found image: ${imageUrl}`);

            if (await validateImageUrl(imageUrl)) {
                return imageUrl;
            } else {
                console.warn(`[CustomSearch] Image validation failed for ${imageUrl}`);
            }
        } else {
            console.log(`[CustomSearch] No items found.`);
        }

        return null;
    } catch (error) {
        console.error("[CustomSearch] Error:", error);
        return null;
    }
}

async function generateTagsWithGemini(title: string, description: string): Promise<string[] | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY not set");
        return null;
    }

    try {
        const prompt = `Based on the following information, generate 15-20 relevant, specific, and comprehensive tags.
CRITICAL: You MUST include at least one of the following "primary category" tags if it applies: ${JSON.stringify(PRIMARY_TAGS)}.

TAGGING GUIDELINES:
- Include the exact item title as a tag (camelCase).
- Include genres, key people, characters, themes, and moods.
- Use camelCase or PascalCase (no spaces).

Return ONLY a JSON array of strings, nothing else.

Title: "${title}"
Description: "${description}"

Generate tags now:`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!res.ok) return null;

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        // Extract JSON array from response
        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) return null;

        const tags = JSON.parse(jsonMatch[0]);
        // Remove slice limit and sanitize tags
        return Array.isArray(tags) ? tags.map((t: string) => t.replace(/^#/, '').toLowerCase()) : null;
    } catch (error) {
        console.error("Gemini tag generation error:", error);
        return null;
    }
}

async function fetchFromGemini(query: string): Promise<GeminiEnrichResult | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY not set");
        return null;
    }

    try {
        const prompt = `You are a helpful assistant that provides structured information about items.

For the query: "${query}"

Provide a JSON response with the following structure:
{
  "description": "A 2-3 sentence description",
  "imageHint": "See IMAGE RULES below",
  "link": "Official website URL if known, otherwise empty string",
  "location": "Physical address if applicable, otherwise empty string",
  "tags": ["category", "tag1", "tag2"],
  "domain": "If imageHint is CLEARBIT, provide the domain (e.g., 'starbucks.com'), otherwise empty string"
}

IMAGE RULES (set imageHint accordingly):
- MOVIES/BOOKS/ALBUMS/TV SHOWS/PLACES/LANDMARKS: Set imageHint to "AUTO_FETCH"
- RESTAURANTS/BARS/BRANDS/PRODUCTS/WEBSITES/COMPANIES: Set imageHint to "CLEARBIT"

CRITICAL: The "tags" array MUST include at least one of these primary categories: ${JSON.stringify(PRIMARY_TAGS)}.

TAGGING RULES:
- Generate 15-20 comprehensive tags.
- Include the exact item title as a tag (e.g. #2001ASpaceOdyssey).
- Include genres/sub-genres (e.g. #scifi, #sciencefiction).
- Include key people/creators (e.g. #StanleyKubrick, #ArthurCClarke).
- Include key characters (e.g. #HAL9000).
- Include themes, moods, and concepts (e.g. #AI, #space, #masterpiece).
- Use camelCase or PascalCase for multi-word tags (no spaces).

Only return the JSON, no other text.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!res.ok) return null;

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;

        // Extract JSON from response (might have markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const result = JSON.parse(jsonMatch[0]);
        if (result.tags && Array.isArray(result.tags)) {
            result.tags = result.tags.map((t: string) => t.replace(/^#/, '').toLowerCase());
        }
        return result;
    } catch (error) {
        console.error("Gemini error:", error);
        return null;
    }
}

function extractLocation(entity: any): string {
    // Try to find location from Knowledge Graph entity
    if (entity.detailedDescription?.articleBody) {
        const text = entity.detailedDescription.articleBody;
        // Simple heuristic: look for "in [Location]" or "located in"
        const match = text.match(/(?:in|located in)\s+([A-Z][^,.]+(?:,\s*[A-Z][^,.]+)?)/);
        if (match) return match[1].trim();
    }
    return "";
}

function extractTags(entity: any): string[] {
    const tags: string[] = [];

    // 1. Try to assume primary tag from KG Type
    if (entity["@type"]) {
        const types = Array.isArray(entity["@type"]) ? entity["@type"] : [entity["@type"]];

        let foundPrimary = false;
        for (const t of types) {
            const mapped = KG_TYPE_MAPPING[t];
            if (mapped) {
                tags.push(mapped);
                foundPrimary = true;
                break; // Prioritize the first match
            }
        }

        // Add raw types (cleaned) if we want fallback or extra detail
        tags.push(...types.filter((t: string) => t !== "Thing").map((t: string) => t.replace(/([A-Z])/g, ' $1').trim().toLowerCase()));
    }

    return Array.from(new Set(tags)).slice(0, 5); // Unique tags, limit to 5
}

// --- SPECIALIZED ENRICHMENT FETCHERS ---

interface MediaDetails {
    imageURL: string;
    url: string;
}

// Master Router for Specialized Artwork & URLs
async function fetchBestArtworkAndURL(title: string, category: string): Promise<MediaDetails> {
    const cat = category.toLowerCase();

    if (cat === "movie") {
        return await fetchTMDBArtworkAndURL(title, "movie");
    } else if (cat === "tv show" || cat === "tv series") {
        return await fetchTMDBArtworkAndURL(title, "tv");
    } else if (cat === "book") {
        return await fetchGoogleBooksArtworkAndURL(title);
    } else if (cat === "music" || cat === "album" || cat === "song") {
        return await fetchITunesArtworkAndURL(title);
    }

    return { imageURL: "", url: "" };
}

// TMDB (Movies & TV)
async function fetchTMDBArtworkAndURL(query: string, type: "movie" | "tv"): Promise<MediaDetails> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return { imageURL: "", url: "" };

    try {
        const endpoint = type === "movie" ? "search/movie" : "search/tv";
        const url = `https://api.themoviedb.org/3/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1&include_adult=false`;

        const res = await fetch(url);
        if (!res.ok) return { imageURL: "", url: "" };

        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const firstMatch = data.results[0];
            const posterPath = firstMatch.poster_path;
            const id = firstMatch.id;

            const imageURL = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : "";
            const pageUrl = type === "movie"
                ? `https://www.themoviedb.org/movie/${id}`
                : `https://www.themoviedb.org/tv/${id}`;

            return { imageURL, url: pageUrl };
        }
    } catch (e) {
        console.error("TMDB error:", e);
    }
    return { imageURL: "", url: "" };
}

// Google Books
async function fetchGoogleBooksArtworkAndURL(query: string): Promise<MediaDetails> {
    try {
        const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=1`;
        const res = await fetch(url);
        if (!res.ok) return { imageURL: "", url: "" };

        const data = await res.json();
        if (data.items && data.items.length > 0) {
            const volumeInfo = data.items[0].volumeInfo;
            const imageLinks = volumeInfo.imageLinks || {};

            // Try enabling best quality
            let imageURL = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail || "";
            if (imageURL) imageURL = imageURL.replace(/^http:\/\//, "https://");

            const pageUrl = volumeInfo.canonicalVolumeLink || volumeInfo.infoLink || "";

            return { imageURL, url: pageUrl };
        }
    } catch (e) {
        console.error("Google Books error:", e);
    }
    return { imageURL: "", url: "" };
}

// iTunes (Music)
async function fetchITunesArtworkAndURL(query: string): Promise<MediaDetails> {
    try {
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=1`;
        const res = await fetch(url);
        if (!res.ok) return { imageURL: "", url: "" };

        const data = await res.json();
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            let imageURL = result.artworkUrl100 || "";
            if (imageURL) {
                // Upscale to 600x600
                imageURL = imageURL.replace("100x100", "600x600");
            }
            const pageUrl = result.collectionViewUrl || result.artistViewUrl || "";

            return { imageURL, url: pageUrl };
        }
    } catch (e) {
        console.error("iTunes error:", e);
    }
    return { imageURL: "", url: "" };
}
