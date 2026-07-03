const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 1. Manually parse .env variables to avoid dependencies on dotenv
const envPath = path.join(__dirname, "../.env");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found. Please create it first.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : "";
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const tursoUrl = env.TURSO_DATABASE_URL;
const tursoToken = env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error("Error: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not found in .env.");
  process.exit(1);
}

console.log("Connecting to Turso database: " + tursoUrl);

// 2. Generate SQL schema via Prisma migrate diff
console.log("Generating database migration schema...");
let sql = "";
try {
  sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf-8" }
  );
} catch (err) {
  console.error("Error generating schema diff:", err.message);
  process.exit(1);
}

// 3. Connect using @libsql/client
const { createClient } = require("@libsql/client");
const client = createClient({
  url: tursoUrl,
  authToken: tursoToken,
});

// 4. Split and execute SQL statements
const statements = sql
  .split(";")
  .map(stmt => {
    // Strip comments
    return stmt
      .split("\n")
      .filter(line => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
  })
  .filter(stmt => stmt.length > 0);

async function run() {
  try {
    console.log(`Executing ${statements.length} SQL statements on Turso...`);
    
    // We run them in sequence
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const cmdPreview = stmt.split("\n")[0];
      console.log(`[${i + 1}/${statements.length}] Running: ${cmdPreview}...`);
      await client.execute(stmt);
    }
    
    console.log("Turso Cloud Database sync complete! Database is officially pushed to the cloud. 🚀");
  } catch (err) {
    console.error("Error executing migration on Turso:", err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

run();
