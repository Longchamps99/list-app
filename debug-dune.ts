
import dotenv from 'dotenv';
dotenv.config();

import { enrichContent, searchCandidates } from './lib/enrich';

async function test() {
    console.log("--- Testing Search Candidates for 'Dune' ---");
    const candidates = await searchCandidates("Dune");
    console.log("Candidates found:", candidates.length);
    if (candidates.length > 0) {
        console.log("First Candidate Image:", candidates[0].imageUrl);
    }

    console.log("\n--- Testing Enrichment for 'Dune' ---");
    // Simulate what happens when user selects the first candidate (if there is one)
    const entityId = candidates.length > 0 ? candidates[0].id : undefined;
    const initialImage = candidates.length > 0 ? candidates[0].imageUrl : undefined;

    console.log(`Enriching with EntityID: ${entityId}, InitialImage: ${initialImage}`);

    const result = await enrichContent("Dune", entityId, initialImage);
    console.log("\nFinal Result Image:", result?.imageUrl);
}

test();
