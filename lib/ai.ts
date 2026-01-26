// Simulate AI Tagging Service

export async function generateTags(content: string): Promise<string[]> {
    // Mock simulation delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const tags: string[] = [];
    const lower = content.toLowerCase();

    // Simple keyword matching logic for "AI"
    if (lower.includes("milk") || lower.includes("bread") || lower.includes("cheese") || lower.includes("groceries")) {
        tags.push("Groceries");
        tags.push("Food");
    }
    if (lower.includes("sunscreen") || lower.includes("towel") || lower.includes("swim") || lower.includes("beach")) {
        tags.push("Vacation");
        tags.push("Summer");
    }
    if (lower.includes("meeting") || lower.includes("email") || lower.includes("report")) {
        tags.push("Work");
    }
    if (lower.includes("gym") || lower.includes("run") || lower.includes("workout")) {
        tags.push("Health");
    }

    // Always add a "New" tag for testing if no other tags found
    if (tags.length === 0) {
        tags.push("Misc");
    }

    return Array.from(new Set(tags));
}
