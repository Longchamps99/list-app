
import { enrichItems } from "../lib/enrichment";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env file manually
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, value] = line.split("=");
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, "");
        }
    });
}

async function run() {
    console.log("Testing enrichItems...");

    const items = ["Borat", "Logan", "Thor: Ragnarok"];
    // Intentionally using same items to compare if tags increase

    try {
        const enriched = await enrichItems(items);
        console.log("Enriched Items:", JSON.stringify(enriched, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

run();
