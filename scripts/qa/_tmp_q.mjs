import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.QA_DB_URL });
for (const sql of process.argv.slice(2)) console.log(sql, JSON.stringify((await db.execute(sql)).rows).slice(0, 900));
