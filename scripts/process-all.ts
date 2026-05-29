import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { processAll } from "../src/lib/pipeline";

const reprocess = process.argv.includes("--reprocess");
const concurrency = (() => {
  const i = process.argv.indexOf("--concurrency");
  return i > -1 ? parseInt(process.argv[i + 1], 10) : 3;
})();

console.log(
  `Processing posts (reprocess=${reprocess}, concurrency=${concurrency})...\n`
);

processAll({ reprocess, concurrency })
  .then(({ total, results, ms }) => {
    const counts = { drafted: 0, blocked: 0, skipped: 0, failed: 0 };
    for (const r of results) counts[r.status]++;

    console.log(`Processed ${total} post(s) in ${(ms / 1000).toFixed(1)}s:`);
    console.log(`  ✅ drafted:  ${counts.drafted}`);
    console.log(`  🛑 blocked:  ${counts.blocked}  (safety filter)`);
    console.log(`  ⏭️  skipped:  ${counts.skipped}  (low relevance)`);
    console.log(`  ❌ failed:   ${counts.failed}`);

    if (counts.failed > 0) {
      console.log("\nFailures:");
      for (const r of results.filter((r) => r.status === "failed")) {
        console.log(`  ${r.post_id}: ${r.error}`);
      }
    }

    if (total === 0) {
      console.log(
        "\n(All posts already have drafts. Run with --reprocess to redraft.)"
      );
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
