const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

// Manually parse .env variables
const envPath = path.join(__dirname, "../.env");
if (!fs.existsSync(envPath)) {
  console.error("Error: .env file not found.");
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

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const statements = [
  'DROP TABLE IF EXISTS "Message"',
  'CREATE TABLE "Conversation" ( "id" TEXT NOT NULL PRIMARY KEY, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP )',
  'CREATE TABLE "_UserConversations" ( "A" TEXT NOT NULL, "B" TEXT NOT NULL, CONSTRAINT "_UserConversations_A_fkey" FOREIGN KEY ("A") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "_UserConversations_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE )',
  'CREATE TABLE "Message" ( "id" TEXT NOT NULL PRIMARY KEY, "body" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "senderId" TEXT NOT NULL, "conversationId" TEXT NOT NULL, CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE )',
  'CREATE UNIQUE INDEX IF NOT EXISTS "_UserConversations_AB_unique" ON "_UserConversations"("A", "B")',
  'CREATE INDEX IF NOT EXISTS "_UserConversations_B_index" ON "_UserConversations"("B")'
];

async function run() {
  console.log("Applying delta migration to Turso Cloud Database...");
  try {
    for (const stmt of statements) {
      console.log("Running statement:", stmt.substring(0, 50) + "...");
      await client.execute(stmt);
    }
    console.log("Migration applied successfully to Turso! 🎉");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.close();
  }
}

run();
