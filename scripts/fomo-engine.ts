import { PrismaClient, Role } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

// 1. Load environmental variables
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

// 50 realistic Vietnamese names
const CLONE_NAMES = [
  "Tuấn MMO", "Lan HR", "Khang Thợ Xe", "Hương Du Lịch", "Minh Grab",
  "Bảo Coder", "Trang Spa", "Duy Crypto", "Phượng Tuyển Dụng", "Nam Tiện Ích",
  "Hoàng Lập Trình", "Mai Nhân Sự", "Kiệt Sửa Khóa", "Yến Khách Sạn", "Hải Giao Hàng",
  "Quân Backend", "Linh Nail Spa", "Hùng Airdrop", "Thảo Headhunter", "Cường Tài Xế",
  "Đức Frontend", "Vân PetGrooming", "Long TradeCoin", "Nga Recruiter", "Bình Ba Gác",
  "Tùng Fullstack", "Oanh Thẩm Mỹ", "Tấn MMO Master", "Hạnh HR Manager", "Thắng Xe Tải",
  "Sơn Dev", "Hồng Spa & Clinic", "Phúc Solona", "Cúc Tuyển Dụng IT", "Khoa Shipper",
  "Vinh Web3", "Nguyệt Massage", "Lâm Affilate", "Tuyết HR Lead", "Thịnh Dịch Vụ",
  "Phương React", "Trúc Thú Y", "Quang MMO Newbie", "Kim Săn Nhân Tài", "Thành Vận Tải",
  "Hiếu Python", "Hà Cún Miêu Spa", "Trung MMO Builder", "Vy HR Tech", "Kiên Tự Do"
];

// Content templates pool as safe fallback
const FALLBACK_POSTS = [
  "Cay thật sự! Làm việc cật lực cả tháng xong công ty nợ lương, nhắn tin đòi thì sếp khất hết tuần này đến tuần khác. Ai định vào né gấp nhé!",
  "Mới đi phỏng vấn về. Bắt làm test 3 tiếng xong kêu chờ kết quả, cuối cùng im re luôn. Đúng kiểu HR vô trách nhiệm, phí thời gian ghê.",
  "Dịch vụ khách sạn Nha Trang đợt này tệ kinh khủng. Điều hòa hỏng gọi sửa thì lờ đi, ga trải giường bẩn. Đi nghỉ dưỡng mà rước bực vào người.",
  "Tìm thợ sửa xe máy có tâm ở Hà Nội khó dã man. Vào tiệm dọc đường thay cái bugi thôi mà nó chém cho mấy trăm nghìn xót hết cả ruột.",
  "Cảnh báo tiệm spa thú cưng chó mèo làm ăn tắc trách. Tắm sấy xong làm lở loét cả da tai cún nhà mình. Cạch mặt luôn!"
];

const FALLBACK_COMMENTS = [
  "Chuẩn luôn bác ơi, thời nay đi làm sợ nhất mấy vụ này.",
  "Thôi bớt giận bác, tìm chỗ khác uy tín mà làm cho lành.",
  "Haha đúng là trải nghiệm nhớ đời, chia buồn cùng thớt nhé."
];

// Helper to pick random item
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

async function getCloneUsers() {
  let users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: "clone"
      }
    }
  });

  // If no clone users exist, create them
  if (users.length === 0) {
    console.log("No clone users found. Creating 50 virtual accounts first...");
    const avatarUrls = [
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80"
    ];

    for (let i = 0; i < CLONE_NAMES.length; i++) {
      try {
        const u = await prisma.user.create({
          data: {
            name: CLONE_NAMES[i],
            email: `clone${i + 1}@pawbook.vn`,
            password: "$2a$10$U7vS547B2hH/yP65iV5jbeo.uRUp885G.4t5fA55P3qQz/uU67H4G", // password123
            role: Role.USER,
            avatarUrl: randomItem(avatarUrls),
            bio: "Thành viên tích cực chia sẻ kinh nghiệm trên mạng xã hội BitPaw.",
            pawCoin: 200,
            reputation: 20,
            trustScore: 4.8,
            isVerified: Math.random() > 0.8
          }
        });
        users.push(u);
      } catch (e) {
        // Suppress unique constraint logs
      }
    }
  }
  return users;
}

// Resilient fallback execution function
function generateStaticFomoPost(): string {
  console.log("Using static template seeder fallback...");
  return randomItem(FALLBACK_POSTS);
}

async function main() {
  console.log("=== FOMO AUTO CONTENT ENGINE ===");

  const cloneUsers = await getCloneUsers();
  if (cloneUsers.length === 0) {
    console.error("Failed to fetch or seed clone users. Exiting.");
    process.exit(1);
  }

  // 1. Initialize Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  let genAI: GoogleGenerativeAI | null = null;
  if (apiKey) {
    console.log("Gemini API key found. Initializing GoogleGenerativeAI...");
    genAI = new GoogleGenerativeAI(apiKey);
  } else {
    console.warn("GEMINI_API_KEY not set in environment variables. Falling back to local data matrix.");
  }

  const topics = [
    "áp lực công việc hàng ngày / bị công ty nợ lương",
    "gặp nhà nghỉ du lịch Nha Trang chặt chém chặt đẹp",
    "bị tài xế công nghệ hoặc xe ôm hét giá ảo",
    "spa chăm sóc thú cưng làm lông chó mèo xơ xác"
  ];
  const selectedTopic = randomItem(topics);
  console.log(`Selected Topic: ${selectedTopic}`);

  // 2. AI Post Content Generation
  let postContent = "";
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Đóng vai một người dùng mạng xã hội tại Việt Nam, viết 1 status (dưới 80 chữ) phàn nàn chân thực về: ${selectedTopic}. Ngôn ngữ đời thường, tiếng lóng Việt Nam, giọng điệu tức giận hoặc châm biếm của người thật, không dùng hashtag, không có tiêu đề, không chào hỏi trịnh trọng.`;
      
      const result = await model.generateContent(prompt);
      postContent = result.response.text().trim();
      if (postContent.startsWith('"') && postContent.endsWith('"')) {
        postContent = postContent.slice(1, -1);
      }
    } catch (err: any) {
      console.error("Gemini API post generation failed or timed out:", err.message);
      postContent = generateStaticFomoPost();
    }
  } else {
    postContent = generateStaticFomoPost();
  }

  // Insert post into database under a random clone
  const postAuthor = randomItem(cloneUsers);
  console.log(`Creating post by clone user: ${postAuthor.name}`);

  const createdPost = await prisma.post.create({
    data: {
      content: postContent,
      authorId: postAuthor.id,
      createdAt: new Date()
    }
  });
  console.log(`Successfully created Post ID: ${createdPost.id}`);
  console.log(`Content: "${postContent}"`);

  // 3. Simulated Likes (15-35)
  const likesCount = Math.floor(Math.random() * 21) + 15; // 15 to 35
  console.log(`Auto Likes: Selected ${likesCount} clone users to simulated reaction list. (Handled on client-side state)`);

  // 4. AI Comments Generation
  console.log("Generating comments...");
  let comments: string[] = [];

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Dựa vào status phàn nàn này: "${postContent}", hãy viết 3 bình luận ngắn gọn từ 3 người dùng khác nhau trên mạng xã hội Việt Nam (đặc biệt giọng điệu gen Z).
Một người đồng tình/chia sẻ, một người khuyên nhủ/bình tĩnh, một người châm biếm/mỉa mai.
Giọng điệu đời thường, tự nhiên, cực kỳ ngắn gọn (mỗi bình luận dưới 20 chữ).
Trả về chính xác 3 dòng, mỗi dòng là một bình luận, không ghi số thứ tự, không có ngoặc kép ở đầu dòng.`;

      const result = await model.generateContent(prompt);
      const rawCommentsText = result.response.text();
      comments = rawCommentsText
        .split("\n")
        .map(line => line.replace(/^\d+[\.\-\)]\s*/, "").replace(/^["']|["']$/g, "").trim())
        .filter(line => line.length > 0)
        .slice(0, 3);
    } catch (err: any) {
      console.error("Gemini API comment generation failed or timed out:", err.message);
    }
  }

  // Fallback if comments generation failed or has fewer than 3 items
  if (comments.length < 3) {
    comments = [...comments, ...FALLBACK_COMMENTS].slice(0, 3);
  }

  // Pick 3 random distinct clones for comments
  const candidatesForComments = cloneUsers.filter(u => u.id !== postAuthor.id);
  const selectedClonesForComments: typeof cloneUsers = [];
  while (selectedClonesForComments.length < 3 && candidatesForComments.length > 0) {
    const idx = Math.floor(Math.random() * candidatesForComments.length);
    selectedClonesForComments.push(candidatesForComments.splice(idx, 1)[0]);
  }

  // Insert comments into database
  for (let i = 0; i < comments.length; i++) {
    const commentator = selectedClonesForComments[i] || randomItem(cloneUsers);
    const commentText = comments[i];

    try {
      await prisma.comment.create({
        data: {
          content: commentText,
          postId: createdPost.id,
          authorId: commentator.id,
          createdAt: new Date(Date.now() + (i + 1) * 60 * 1000)
        }
      });
      console.log(`  💬 Comment by "${commentator.name}": "${commentText}"`);
    } catch (e: any) {
      console.error(`Failed to insert comment: ${e.message}`);
    }
  }

  console.log("\n=== FOMO CYCLE COMPLETE. EXITING SUCCESS ===\n");
  process.exit(0);
}

main()
  .catch((err) => {
    console.error("Fomo Engine crash:", err);
    process.exit(1);
  });
