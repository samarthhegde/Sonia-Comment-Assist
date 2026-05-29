import { ingestSubreddit } from "../src/lib/ingest/reddit";

const [, , subredditArg, limitArg, sortArg] = process.argv;

if (!subredditArg) {
  console.error(
    "Usage: npm run ingest:reddit -- <subreddit> [limit=15] [sort=new|hot|top]\n" +
      "Example: npm run ingest:reddit -- r/getdisciplined 10 new"
  );
  process.exit(1);
}

const limit = limitArg ? parseInt(limitArg, 10) : 15;
const sort = (sortArg as "new" | "hot" | "top") ?? "new";

console.log(`Fetching r/${subredditArg.replace(/^r\//, "")} (${sort}, limit=${limit})...`);

ingestSubreddit({ subreddit: subredditArg, limit, sort })
  .then((result) => {
    console.log(`\nIngest complete:`);
    console.log(`  fetched:       ${result.total}`);
    console.log(`  inserted:      ${result.inserted}`);
    console.log(`  already there: ${result.skipped}`);
  })
  .catch((err) => {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  });
