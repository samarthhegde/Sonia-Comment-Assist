import { seedPosts } from "../src/lib/seed";

const result = seedPosts();
console.log(`Seed complete:`);
console.log(`  total in file: ${result.total}`);
console.log(`  inserted:      ${result.inserted}`);
console.log(`  already there: ${result.skipped}`);
