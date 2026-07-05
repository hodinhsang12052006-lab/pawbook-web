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
    console.log("Creating 'Booking' table on Turso Cloud Database...");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS Booking (
        id TEXT PRIMARY KEY NOT NULL,
        jobId TEXT,
        serviceId TEXT,
        senderId TEXT NOT NULL,
        receiverId TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING' NOT NULL,
        message TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (jobId) REFERENCES Job (id) ON DELETE CASCADE,
        FOREIGN KEY (serviceId) REFERENCES Service (id) ON DELETE CASCADE,
        FOREIGN KEY (senderId) REFERENCES User (id) ON DELETE CASCADE,
        FOREIGN KEY (receiverId) REFERENCES User (id) ON DELETE CASCADE
      );
    `);
    console.log("Success: Created 'Booking' table.");
  } catch (error) {
    console.error("Failed to create Booking table:", error.message);
  }

  client.close();
  console.log("Database schema synced!");
}

run();
