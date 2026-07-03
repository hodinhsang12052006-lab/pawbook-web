const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env");
let databaseUrl = "";
let authToken = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] ? match[2].trim() : "";
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      if (key === "TURSO_DATABASE_URL") databaseUrl = val;
      if (key === "TURSO_AUTH_TOKEN") authToken = val;
    }
  });
}

if (!databaseUrl) {
  databaseUrl = "libsql://pawbook-db-hodinhsang12052006.aws-ap-northeast-1.turso.io";
  authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODMwMTU1MzIsImlkIjoiMDE5ZjI0MDEtNWMwMS03N2RkLWFhOGItMWM4OTMwZmU5ODE1Iiwia2lkIjoiT3N1bk0wdXVRaXJ3azBiczhZd1pmRm1HMUhUaW9WRjNzcHJmZTU4T1lPRSIsInJpZCI6ImI3MjAwODI0LWVlMGMtNDlkMi1hMTA0LTFhZGZkMWZhMzE2MyJ9.9x9z0Cu9PiG8ztNB15JjcL5l2WzEFfrM9kdRd-NNWjMb9OEHQIKzmKNvo1wLyDRSOrj2tOcuLlxP7t4ha52kCA";
}

async function run() {
  console.log("Connecting to Turso Cloud DB:", databaseUrl);
  const client = createClient({ url: databaseUrl, authToken: authToken });
  
  try {
    console.log("Adding 'isGroup' column to 'Conversation'...");
    await client.execute("ALTER TABLE Conversation ADD COLUMN isGroup BOOLEAN DEFAULT 0;");
    console.log("Success: Added 'isGroup' column.");
  } catch (error) {
    console.log("isGroup check:", error.message);
  }

  try {
    console.log("Adding 'name' column to 'Conversation'...");
    await client.execute("ALTER TABLE Conversation ADD COLUMN name TEXT;");
    console.log("Success: Added 'name' column.");
  } catch (error) {
    console.log("name check:", error.message);
  }

  try {
    console.log("Adding 'type' column to 'Message'...");
    await client.execute("ALTER TABLE Message ADD COLUMN type TEXT DEFAULT 'TEXT';");
    console.log("Success: Added 'type' column.");
  } catch (error) {
    console.log("type check:", error.message);
  }

  client.close();
  console.log("Database schema altered successfully!");
}

run();
