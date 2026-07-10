import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import fs from "fs";
import path from "path";

// 1. Manually parse .env variables to ensure Prisma/LibSQL knows where to connect
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

// Initialize Prisma Client with Turso adapter if configured
let prisma: PrismaClient;
if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql as any);
  prisma = new PrismaClient({ adapter: adapter as any });
} else {
  prisma = new PrismaClient();
}

// Setup database table if running on Turso or SQLite
async function ensureStoreTableExists() {
  console.log("Checking / initializing database Store table...");
  const sqlCreate = `
    CREATE TABLE IF NOT EXISTS "Store" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "rating" REAL,
      "reviewCount" INTEGER DEFAULT 0,
      "address" TEXT NOT NULL,
      "latitude" REAL,
      "longitude" REAL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  const sqlIndex = `
    CREATE UNIQUE INDEX IF NOT EXISTS "Store_name_address_key" ON "Store"("name", "address");
  `;

  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    try {
      await libsql.execute(sqlCreate);
      await libsql.execute(sqlIndex);
      console.log("Successfully initialized Store table on Turso cloud database. 🚀");
    } catch (e: any) {
      console.warn("Could not check/create table on Turso directly. Proceeding...", e.message);
    } finally {
      libsql.close();
    }
  } else {
    try {
      await prisma.$executeRawUnsafe(sqlCreate);
      await prisma.$executeRawUnsafe(sqlIndex);
      console.log("Successfully initialized Store table on local SQLite database. 💾");
    } catch (e: any) {
      console.warn("Could not check/create table on local SQLite directly. Proceeding...", e.message);
    }
  }
}

// Recursive helper to get all JSON files in a directory
function getJsonFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getJsonFiles(filePath));
    } else if (file.endsWith(".json")) {
      results.push(filePath);
    }
  }
  return results;
}

const ALL_SERVICES = [
  "Cứu hộ xe máy", "Cứu hộ ô tô", "Thợ sửa khóa", "Sửa điện nước khẩn cấp",
  "Thông tắc vệ sinh", "Nhà thuốc 24/7", "Cấp cứu thú y", "Diệt côn trùng",
  "Sửa chữa máy lạnh", "Sửa điện máy gia dụng", "Dọn dẹp nhà cửa", "Giặt ủi nội thất",
  "Thợ xây sửa nhỏ", "Lắp đặt camera", "Sửa cửa cuốn cửa kính",
  "Cắt tóc nam barber", "Salon tóc nữ", "Spa Massage", "Tiệm Nails",
  "Phun xăm thẩm mỹ", "Phòng tập Gym Yoga", "Trang điểm Makeup",
  "Thuê xe máy", "Thuê ô tô tự lái", "Chuyển nhà trọn gói", "Xe tải chở thuê",
  "Đưa đón sân bay", "Tài xế lái xe hộ", "Chạy xe ôm công nghệ Grab",
  "Giặt ủi dân dụng", "Giao gas tận nhà", "Giao nước khoáng", "Sửa quần áo giày dép",
  "In ấn Photocopy", "Rửa xe chăm sóc xe", "Giao đá viên hỏa tốc", "Sửa chữa máy tính laptop",
  "Spa thú cưng", "Khách sạn thú cưng", "Trông trẻ theo giờ",
  "Gia sư trung tâm dạy kèm", "Khu vui chơi trẻ em",
  "Quán ăn đêm", "Cà phê làm việc", "Cyber Gaming tiệm net", "Billiards bida",
  "Karaoke", "Nấu tiệc tại nhà", "Thuê đồ sự kiện", "Cho thuê trang phục",
  "Y tế tại nhà", "Dịch vụ giấy tờ pháp lý", "Mua bán sửa chữa điện thoại iphone",
  "Taxi xe ôm chở thú cưng"
];

function slugifyKeyword(str: string): string {
  if (str === "Taxi xe ôm chở thú cưng") {
    return "xe_om_thu_cung";
  }
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .trim();
}

function getExactKeyword(filename: string): string {
  const cleanName = filename.replace(".json", "");
  const matched = ALL_SERVICES.find(srv => slugifyKeyword(srv) === slugifyKeyword(cleanName));
  return matched || cleanName.replace(/_/g, " ");
}

async function main() {
  console.log("=== STEP 2: NATIONWIDE DATABASE SEEDER ===");

  const DATA_DIR = path.join(process.cwd(), "data_crawled");
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Error: Directory ${DATA_DIR} does not exist! Please run the scraper script (Step 1) first.`);
    process.exit(1);
  }

  // 1. Get all partitioned JSON files
  console.log("Reading partitioned JSON files in data_crawled...");
  const jsonFiles = getJsonFiles(DATA_DIR);
  console.log(`Found ${jsonFiles.length} data files.`);

  if (jsonFiles.length === 0) {
    console.log("No JSON data files found to seed. Exiting...");
    return;
  }

  // 2. Read and aggregate all stores
  const allStores: any[] = [];
  for (const file of jsonFiles) {
    try {
      const fileContent = fs.readFileSync(file, "utf-8");
      const stores = JSON.parse(fileContent);
      if (Array.isArray(stores)) {
        const filename = path.basename(file);
        const resolvedKeyword = getExactKeyword(filename);
        
        stores.forEach((store: any) => {
          store.category = resolvedKeyword; // overwrite English category with resolved Vietnamese keyword
        });

        allStores.push(...stores);
      }
    } catch (e: any) {
      console.error(`Error reading or parsing file ${file}: ${e.message}`);
    }
  }

  console.log(`Loaded ${allStores.length} raw store records from files.`);

  // 3. De-duplicate in memory to avoid unique constraint collisions inside transactions
  const seen = new Set<string>();
  const uniqueStores = allStores.filter((store) => {
    if (!store.name || !store.address) return false;
    const key = `${store.name.toLowerCase().trim()}_${store.address.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`De-duplicated to ${uniqueStores.length} unique store records.`);

  if (uniqueStores.length === 0) {
    console.log("No unique records to seed. Exiting...");
    return;
  }

  // Ensure DB table exists
  await ensureStoreTableExists();

  const start = Date.now();
  const BATCH_SIZE = 200;
  let successfulUpserts = 0;

  console.log(`Starting bulk insert/upsert in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < uniqueStores.length; i += BATCH_SIZE) {
    const batch = uniqueStores.slice(i, i + BATCH_SIZE);

    try {
      // Execute all upserts in the batch as a single Prisma transaction
      await prisma.$transaction(
        batch.map((store) =>
          prisma.store.upsert({
            where: {
              name_address: {
                name: store.name,
                address: store.address,
              },
            },
            update: {
              category: store.category,
              rating: store.rating,
              reviewCount: store.reviewCount,
              latitude: store.latitude,
              longitude: store.longitude,
            },
            create: {
              name: store.name,
              address: store.address,
              category: store.category,
              rating: store.rating,
              reviewCount: store.reviewCount,
              latitude: store.latitude,
              longitude: store.longitude,
            },
          })
        )
      );

      successfulUpserts += batch.length;
      console.log(`  🚀 Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successfulUpserts}/${uniqueStores.length} records...`);
    } catch (err: any) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} transaction failed: ${err.message}`);
      console.log("  🔄 Attempting to insert batch elements individually to recover...");

      // Fallback: Individual insertion on batch failure to preserve valid records
      for (const store of batch) {
        try {
          await prisma.store.upsert({
            where: {
              name_address: {
                name: store.name,
                address: store.address,
              },
            },
            update: {
              category: store.category,
              rating: store.rating,
              reviewCount: store.reviewCount,
              latitude: store.latitude,
              longitude: store.longitude,
            },
            create: {
              name: store.name,
              address: store.address,
              category: store.category,
              rating: store.rating,
              reviewCount: store.reviewCount,
              latitude: store.latitude,
              longitude: store.longitude,
            },
          });
          successfulUpserts++;
        } catch (singleErr: any) {
          console.error(`    ❌ Failed to upsert store "${store.name}": ${singleErr.message}`);
        }
      }
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n=== STAGE 2 COMPLETE. Elapsed Time: ${duration}s ===`);
  console.log(`Successfully synced ${successfulUpserts} / ${uniqueStores.length} unique records into SQLite/Turso database! 🎉`);
}

main()
  .catch((err) => {
    console.error("Seeder crash:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
