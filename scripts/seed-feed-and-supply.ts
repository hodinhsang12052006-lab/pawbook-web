/**
 * Seed Bảng tin (Post/SHOWCASE theo trend nail 2025-2026), Kho hàng Supply,
 * và Đánh giá 2 chiều — dùng lại đúng roster tài khoản demo đã có sẵn từ
 * seed-nail-data.ts / scrape-and-feed-nails.ts (email đuôi @...pawnailjobs.demo),
 * KHÔNG tạo thêm User/Job mới để tránh trùng lặp dữ liệu đã seed trước đó.
 *
 * Chạy: npx tsx scripts/seed-feed-and-supply.ts
 */

import prisma from "../lib/prisma";
import { PostType, ReviewType } from "@prisma/client";

// Ảnh nail art THẬT lấy từ kết quả search sống trên Unsplash (đã verify
// từng URL trả 200 trước khi đưa vào đây) — nhóm theo trend đang hot
// 2025-2026: chrome/mirror, milky white, cat-eye gel, 3D charm, ombre/aura.
const TREND_PHOTOS = [
  "https://images.unsplash.com/photo-1607779097040-26e80aa78e66", // chrome
  "https://images.unsplash.com/photo-1588359953494-0c215e3cedc6",
  "https://images.unsplash.com/photo-1616427592814-195c30c24ea3",
  "https://images.unsplash.com/photo-1641814280326-d74ea2300067",
  "https://images.unsplash.com/photo-1687723977270-4f86dbda39e6",
  "https://images.unsplash.com/photo-1777287216954-2b4b22bb6bf2",
  "https://images.unsplash.com/photo-1777288390469-828f8816231c",
  "https://images.unsplash.com/photo-1544816135-b44f18b3c5d6",
  "https://images.unsplash.com/photo-1680738035931-7befd1382a52",
  "https://images.unsplash.com/photo-1680738035920-ecf299b7837c",
  "https://images.unsplash.com/photo-1787313000803-50044eabb74f",
  "https://images.unsplash.com/photo-1780724079742-2e1a04efb10d",
  "https://images.unsplash.com/photo-1784784760818-a014040d9003",
  "https://images.unsplash.com/photo-1739056238917-d89cd05c48d5",
  "https://images.unsplash.com/photo-1744908135352-e1be7471cfe2",
  "https://images.unsplash.com/photo-1678782307359-064ba12b45ba",
  "https://images.unsplash.com/photo-1659391542239-9648f307c0b1",
  "https://images.unsplash.com/photo-1658492055212-e1acbccfca5a",
  "https://images.unsplash.com/photo-1613457492120-4fcfbb7c3a5b",
  "https://images.unsplash.com/photo-1660505102581-85cffa4e6550",
  "https://images.unsplash.com/photo-1667207229735-266c430cca15",
  "https://images.unsplash.com/photo-1666226398826-5b7ae0111e9a",
  "https://images.unsplash.com/photo-1648241815778-fdc8daf0d6ef",
  "https://images.unsplash.com/photo-1650176491728-a5e6edd08575",
  "https://images.unsplash.com/photo-1650177043873-ca284558be52",
  "https://images.unsplash.com/photo-1772322586754-34c9e6f5be6f",
  "https://images.unsplash.com/photo-1746607242420-12fc2604775d",
];

// Ảnh lọ sơn/vật tư — cho Supply marketplace, cũng đã verify 200.
const SUPPLY_PHOTOS = [
  "https://images.unsplash.com/photo-1602585578130-c9076e09330d",
  "https://images.unsplash.com/photo-1636019411401-82485711b6ba",
  "https://images.unsplash.com/photo-1599948128020-9a44505b0d1b",
  "https://images.unsplash.com/photo-1636019411480-58321fcb11ce",
  "https://images.unsplash.com/photo-1667769462514-1fd738b38498",
  "https://images.unsplash.com/photo-1640958903443-1e49d720650d",
  "https://images.unsplash.com/photo-1667242197482-ffe672de74da",
  "https://images.unsplash.com/photo-1636019410117-1277a50f9c21",
  // Đợt bổ sung 2 — thêm variety dụng cụ/kit cho mục sản phẩm (đã verify 200).
  "https://images.unsplash.com/photo-1667242197579-10b000f004da",
  "https://images.unsplash.com/photo-1667242196599-d2869afe3c3e",
  "https://images.unsplash.com/photo-1667242196587-33f541537cc6",
  "https://images.unsplash.com/photo-1692881423829-9a2f80d7a84d",
  "https://images.unsplash.com/photo-1667242196578-40ed5d6e5126",
  "https://images.unsplash.com/photo-1619607536077-220f62b03d10",
  "https://images.unsplash.com/photo-1779636198585-658170ee0283",
  "https://images.unsplash.com/photo-1775500835259-d3b3f6d6e2f2",
  "https://images.unsplash.com/photo-1636019411146-354ed94f41be",
  "https://images.unsplash.com/photo-1633394443519-985dc90457db",
  "https://images.unsplash.com/photo-1663229050017-503dbebdd573",
  "https://images.unsplash.com/photo-1663229048792-0734ab152480",
];

function img(list: string[], i: number, w = 900) {
  return `${list[i % list.length]}?w=${w}&auto=format&fit=crop&q=80`;
}

// FOMO về CẢ NGÀNH nail (khan hiếm thợ, tiệm tranh giành khách/trend, giá
// tăng...) thay vì chỉ khoe tay nghề cá nhân — cùng tông với FomoToast.tsx
// (lib/ownerSurvey.ts) để nhất quán trải nghiệm "sợ bỏ lỡ" xuyên suốt app.
const CAPTIONS = [
  "Ngành nail 2026 đang bùng nổ thật sự — tiệm nào cũng tranh nhau tuyển thợ Gel-X, khách đặt lịch trước cả tuần mới có chỗ 🔥",
  "Xu hướng chrome mirror đang cháy hàng khắp các tiệm, thợ nào chưa biết làm kiểu này dễ bị khách bỏ qua lắm đó 💅",
  "Nghe nói mùa này thợ giỏi Ombre/Aura được các tiệm săn đón dữ lắm, lương bao tuần cũng tăng theo luôn 📈",
  "Khách hàng bây giờ tinh mắt lắm, tiệm nào không cập nhật trend mới là mất khách vào tay đối thủ ngay 😱",
  "3D charm đang là kiểu được tìm nhiều nhất tuần này — chậm chân là hết mẫu để làm cho khách à nha!",
  "Nghe đồn cuối năm nay ngành nail còn hot hơn nữa, tiệm nào chuẩn bị nhân sự sớm mới không bị động dịp Tết 🎉",
  "Milky white đang phủ sóng khắp mạng xã hội — không ngạc nhiên khi khách nào cũng đòi làm bằng được kiểu này 🤍",
  "Thợ tay nghề Dip/SNS bây giờ hiếm lắm, tiệm nào giữ được thợ giỏi là coi như nắm chắc phần thắng rồi.",
  "French tip biến tấu đang là cơn sốt mới, không update kịp là tự động tụt lại phía sau so với tiệm khác.",
  "Mùa cưới sắp tới, các tiệm đang chạy đua nhận bộ nail cô dâu — đặt lịch trễ chút là hết suất luôn đó 👰",
  "Cat-eye gel ánh kim đang là kiểu phải có trong tiệm nào muốn giữ chân khách VIP mùa này.",
  "Giá vật tư tăng nhưng khách vẫn xếp hàng dài — chứng tỏ ngành nail chưa bao giờ hạ nhiệt cả.",
  "Aura nails đang là kiểu hot nhất được các bạn trẻ săn lùng, tiệm nào có mẫu này là auto full lịch.",
  "Form vuông dài kiểu Hàn đang làm mưa làm gió, thợ nào chưa luyện tay theo kịp trend này là hơi trễ rồi.",
  "Nghe nói bên Úc/Mỹ tiệm nào có thợ đa năng (vừa bột vừa dip) đang được bao lương cao hơn hẳn năm ngoái.",
  "Top coat bóng gương không ố vàng đang cháy hàng ở khắp các tiệm sỉ — ai cũng tranh nhau đặt trước.",
  "Đợt này khách trẻ chuộng nail tối giản nhưng tinh tế, tiệm nào bắt trend nhanh là hút khách mới ầm ầm.",
  "Ngành nail đang thiếu thợ trầm trọng ở nhiều bang — đây là thời điểm vàng để thợ giỏi tự tin đàm phán lương 🔥",
  "Pastel ombre lên ngôi mùa này, không có mẫu design này trong tiệm coi như bỏ lỡ nguyên nhóm khách trẻ.",
  "Cuối tuần này tiệm nào cũng kín lịch — báo hiệu ngành nail đang bước vào giai đoạn tăng trưởng mạnh nhất năm 🎉",
];

const SUPPLY_ITEMS: { title: string; desc: string; price: number; original?: number }[] = [
  { title: "Bộ sơn Gel 12 màu Trend 2026", desc: "12 màu hot nhất mùa này, chuẩn bảng màu chrome/pastel, hàng chính hãng.", price: 45, original: 60 },
  { title: "Bột Acrylic cao cấp 500g", desc: "Bám dính tốt, không ố vàng, dùng được cho cả đắp form dài.", price: 28 },
  { title: "Set 50 đầu charm 3D Nail Art", desc: "Charm kim loại + đá pha lê, đủ hình trái tim/hoa/ngôi sao.", price: 15, original: 22 },
  { title: "Đèn UV/LED sấy gel 54W", desc: "Sấy nhanh 30s, cảm ứng tự động, bảo hành 6 tháng.", price: 55 },
  { title: "Top Coat + Base Coat Combo", desc: "Bộ đôi bóng gương không ố vàng, khô nhanh trong 60s.", price: 18, original: 25 },
  { title: "Bộ giũa & cọ vẽ nail chuyên nghiệp (10 món)", desc: "Thép không gỉ, cầm chắc tay, dùng bền nhiều năm.", price: 22 },
  { title: "Bột Dip SNS 10 màu Basic", desc: "Màu basic dễ phối, bền màu 3 tuần không sứt mẻ.", price: 35, original: 42 },
  { title: "Máy mài nail mini không dây", desc: "Pin sạc 4 tiếng, êm tay, kèm 6 đầu mài đổi được.", price: 38 },
  { title: "Sơn Chrome Mirror Powder 6 màu", desc: "Hiệu ứng gương bóng loáng, dễ lên màu, ít bụi bay.", price: 20, original: 28 },
  { title: "Khăn giấy lau nail + Cotton pad (Combo 500 tờ)", desc: "Không xơ vải, thấm hút tốt, dùng cho tẩy trang/lau cọ.", price: 9 },
  { title: "Bộ cây đẩy da + kìm cắt da inox cao cấp", desc: "Thép phẫu thuật, bén đều, không gỉ sau nhiều lần tiệt trùng.", price: 16 },
  { title: "Nước rửa cọ vẽ nail chuyên dụng 250ml", desc: "Làm sạch cọ nhanh, giữ lông cọ mềm, không xơ cứng.", price: 12 },
  { title: "Bàn hút bụi nail mini để bàn", desc: "Hút sạch bụi mài, chạy êm, tiết kiệm điện, gọn nhẹ để bàn.", price: 65, original: 85 },
  { title: "Set 6 màu sơn Gel Ombre Aura Trend 2026", desc: "Lên màu loang tự nhiên, chuẩn hiệu ứng aura đang hot.", price: 32, original: 40 },
  { title: "Bộ tay giả luyện tập vẽ nail (silicone)", desc: "Chất liệu mềm dẻo như tay thật, có thể tháo rời từng ngón.", price: 19 },
  { title: "Miếng dán nail art 3D họa tiết mix", desc: "Hơn 200 họa tiết/hộp, dán nhanh không cần vẽ tay.", price: 10 },
  { title: "Bình xịt khử trùng dụng cụ nail 500ml", desc: "Diệt khuẩn nhanh, an toàn cho da tay, mùi nhẹ dễ chịu.", price: 14 },
  { title: "Bộ cọ vẽ nail 15 cây lông mềm cao cấp", desc: "Đủ size từ vẽ chi tiết đến tô nền, cầm cân tay chuyên nghiệp.", price: 26, original: 34 },
  { title: "Khay đựng đồ nghề nail đa năng 3 tầng", desc: "Sắp xếp gọn gàng dụng cụ, khay trượt êm, dễ vệ sinh.", price: 30 },
  { title: "Combo bao tay + khẩu trang y tế tiệm nail (100 cái)", desc: "Đạt chuẩn y tế, bảo vệ thợ và khách khi làm bột/mài.", price: 17 },
];

const REVIEW_COMMENTS_SALON = [
  "Chủ sòng phẳng, trả lương đúng hẹn, môi trường làm việc thoải mái.",
  "Tiệm đông khách, chia turn công bằng, đồng nghiệp thân thiện.",
  "Chủ dễ tính, hỗ trợ thợ mới nhiệt tình, đáng để gắn bó lâu dài.",
  "Lương ổn định, tip khá, chỉ hơi đông khách vào cuối tuần.",
  "Môi trường chuyên nghiệp, chủ luôn lắng nghe ý kiến thợ.",
];
const REVIEW_COMMENTS_TECH = [
  "Thợ tay nghề chắc, khách rất hài lòng, luôn đúng giờ.",
  "Chăm chỉ, cẩn thận, thái độ phục vụ khách rất tốt.",
  "Tay nghề khá, cần cải thiện thêm tốc độ làm việc.",
  "Nhiệt tình, chịu khó học hỏi kỹ thuật mới, khách quay lại nhiều.",
  "Chuyên nghiệp, giao tiếp tốt với khách, đúng như portfolio.",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function main() {
  console.log("🌱 Seed Bảng tin + Supply + Đánh giá...");

  const owners = await prisma.user.findMany({
    where: { role: "OWNER", email: { endsWith: "pawnailjobs.demo" } },
    select: { id: true, name: true, market: true, state: true, city: true },
  });
  const techs = await prisma.user.findMany({
    where: { role: "TECHNICIAN", email: { endsWith: "pawnailjobs.demo" } },
    select: { id: true, name: true, market: true, state: true, city: true },
  });
  console.log(`  Tìm thấy ${owners.length} chủ tiệm, ${techs.length} thợ nail demo.`);
  if (owners.length === 0 && techs.length === 0) {
    console.error("❌ Không tìm thấy user demo nào — chạy seed-nail-data.ts trước.");
    process.exit(1);
  }

  // ===== 0) DỌN DẸP — xóa Post/SupplyProduct đã seed lần trước của roster
  // demo này, để script chạy lại (đổi caption/ảnh) không tạo trùng lặp.
  // Không đụng tới Review (đã dùng upsert từ trước) hay bất kỳ dữ liệu
  // KHÔNG phải do demo user tạo ra.
  const demoUserIds = [...owners, ...techs].map((u) => u.id);
  const deletedPosts = await prisma.post.deleteMany({ where: { authorId: { in: demoUserIds } } });
  const deletedSupply = await prisma.supplyProduct.deleteMany({ where: { sellerId: { in: demoUserIds } } });
  console.log(`  🧹 Đã xóa ${deletedPosts.count} bài đăng cũ, ${deletedSupply.count} sản phẩm supply cũ để seed lại.`);

  // ===== 1) BẢNG TIN — Post SHOWCASE theo trend =====
  const allUsers = [...owners, ...techs];
  let postCount = 0;
  for (let i = 0; i < allUsers.length; i++) {
    const u = allUsers[i];
    const mediaUrls = [img(TREND_PHOTOS, i), img(TREND_PHOTOS, i + 7)];
    await prisma.post.create({
      data: {
        authorId: u.id,
        content: pick(CAPTIONS, i),
        postType: PostType.SHOWCASE,
        mediaUrls: JSON.stringify(mediaUrls),
        market: u.market,
        state: u.state,
        city: u.city,
      },
    });
    postCount++;
  }
  console.log(`  ✓ Đã tạo ${postCount} bài đăng SHOWCASE (ảnh trend nail).`);

  // ===== 2) SUPPLY — mỗi 10 owner đầu đăng 1 sản phẩm =====
  let supplyCount = 0;
  const sellers = owners.slice(0, SUPPLY_ITEMS.length);
  for (let i = 0; i < sellers.length; i++) {
    const seller = sellers[i];
    const item = SUPPLY_ITEMS[i];
    await prisma.supplyProduct.create({
      data: {
        sellerId: seller.id,
        title: item.title,
        description: item.desc,
        imageUrl: img(SUPPLY_PHOTOS, i),
        price: item.price,
        originalPrice: item.original ?? null,
      },
    });
    supplyCount++;
  }
  console.log(`  ✓ Đã đăng ${supplyCount} sản phẩm Supply.`);

  // ===== 3) ĐÁNH GIÁ 2 CHIỀU — ghép cặp owner/tech theo index =====
  // isVerifiedConnection = false vì đây là dữ liệu seed, không có hội thoại/
  // mở khóa thật giữa 2 bên — giữ đúng ý nghĩa "đã xác minh" cho review thật.
  let reviewCount = 0;
  const pairCount = Math.min(owners.length, techs.length, 15);
  for (let i = 0; i < pairCount; i++) {
    const owner = owners[i];
    const tech = techs[i % techs.length];
    const overallTech = 3 + (i % 3); // 3-5
    const overallSalon = 3 + ((i + 1) % 3); // 3-5

    await prisma.review.upsert({
      where: { authorId_targetUserId: { authorId: owner.id, targetUserId: tech.id } },
      update: {},
      create: {
        type: ReviewType.TECHNICIAN_REVIEW,
        authorId: owner.id,
        targetUserId: tech.id,
        skillAccuracy: 3 + ((i + 1) % 3),
        workEthic: 3 + ((i + 2) % 3),
        customerAttitude: 3 + (i % 3),
        overall: overallTech,
        comment: pick(REVIEW_COMMENTS_TECH, i),
        isVerifiedConnection: false,
      },
    });
    await prisma.review.upsert({
      where: { authorId_targetUserId: { authorId: tech.id, targetUserId: owner.id } },
      update: {},
      create: {
        type: ReviewType.SALON_REVIEW,
        authorId: tech.id,
        targetUserId: owner.id,
        punctualityOrPay: 3 + (i % 3),
        environment: 3 + ((i + 1) % 3),
        turnFairness: 3 + ((i + 2) % 3),
        overall: overallSalon,
        comment: pick(REVIEW_COMMENTS_SALON, i),
        isVerifiedConnection: false,
      },
    });
    reviewCount += 2;
  }
  console.log(`  ✓ Đã tạo ${reviewCount} đánh giá 2 chiều (${pairCount} cặp owner-thợ).`);

  console.log("\n🎉 Seed hoàn tất!");
  console.log(`   ${postCount} bài đăng, ${supplyCount} sản phẩm supply, ${reviewCount} đánh giá.`);
}

main()
  .catch((err) => {
    console.error("❌ Seed thất bại:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
