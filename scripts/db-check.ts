import { db, DB_FILE_PATH } from "../src/lib/db";

console.log(`DB file: ${DB_FILE_PATH}`);

const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all() as Array<{ name: string }>;

console.log("\nTables:");
for (const { name } of tables) {
  const count = (db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get() as { c: number }).c;
  console.log(`  - ${name.padEnd(12)} (${count} rows)`);
}

const expected = ["decisions", "drafts", "posts"];
const actual = tables.map((t) => t.name);
const missing = expected.filter((t) => !actual.includes(t));

if (missing.length > 0) {
  console.error(`\n❌ Missing tables: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("\n✅ All expected tables present.");
