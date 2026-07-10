const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@libsql/client");
const { PrismaLibSQL } = require("@prisma/adapter-libsql");

// Manually parse .env variables to ensure Prisma Client knows where to look
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
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

let prisma;
if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

async function main() {
  console.log("Initializing Mock Crawler engine...");

  // Query existing employers to attach to crawled jobs
  const employers = await prisma.user.findMany({
    where: { role: "EMPLOYER" },
  });

  if (employers.length === 0) {
    console.error("Error: No employers found in database. Please run seeding first.");
    process.exit(1);
  }

  const getRandomEmployer = () => employers[Math.floor(Math.random() * employers.length)].id;

  const mockJobsData = [
    // 1. Vận tải & Giao nhận (Grab Competitor - 5 jobs)
    {
      title: "Xe dịch vụ 4 chỗ/7 chỗ (0% Chiết khấu)",
      description: "Hôm nay em mới chạy cuốc xe dịch vụ từ Quận 1 ra Sân bay, đường kẹt cứng nhưng trộm vía khách thoải mái còn bo thêm. Anh em tài xế chạy xe 4 chỗ hoặc 7 chỗ tự do hợp tác với em nhé, bên em cam kết không thu 1% chiết khấu nào hết, chạy nhiêu hưởng trọn bấy nhiêu nha!",
      salary: "15.000.000đ - 25.000.000đ",
      companyName: "Gia tộc Vận Tải Việt",
      niche: "OTHERS",
      latitude: 10.7782,
      longitude: 106.6975,
      ai_tags: "driver, taxi-service, zero-commission, car-rental",
    },
    {
      title: "Xe ôm công nghệ tự do",
      description: "Chào anh em! Em chạy xe ôm công nghệ tự quản quanh khu vực trung tâm quận 1 và quận 3. Thời gian chạy hoàn toàn tự do, thích thì bật app chạy không thì nghỉ ngơi uống ly nước mía, thu nhập giữ trọn 100% không lo bị bóp chiết khấu 30% như bên hãng khác đâu.",
      salary: "8.000.000đ - 14.000.000đ",
      companyName: "Đội Xe Ôm Tự Quản",
      niche: "OTHERS",
      latitude: 10.7812,
      longitude: 106.7024,
      ai_tags: "motorbike-driver, delivery, travel, free-schedule",
    },
    {
      title: "Ba gác chở đồ trọn gói",
      description: "Anh chị em nào chuẩn bị chuyển phòng trọ, dọn văn phòng hay chở tủ bàn ghế cồng kềnh thì cứ hú em nhé. Xe ba gác máy của em đi được mọi ngóc ngách hẻm nhỏ Sài Gòn/Hà Nội, hỗ trợ bê vác đồ đạc nhiệt tình trọn gói từ A đến Z luôn ạ.",
      salary: "12.000.000đ - 18.000.000đ",
      companyName: "Vận Chuyển Thành Đô",
      niche: "OTHERS",
      latitude: 10.7741,
      longitude: 106.6991,
      ai_tags: "delivery-truck, heavy-lifting, cargo, relocation",
    },
    {
      title: "Shipper giao đồ ăn/hàng hóa quanh khu vực",
      description: "Góc shipper: Hôm nay đơn nổ liên tục chạy bở hơi tai nhưng bù lại ví dày lên chút. Bác nào muốn nhận đơn giao đồ ăn hoặc bưu phẩm khu vực xung quanh kiếm thêm thu nhập thì liên hệ em cùng chạy đội nhóm cho vui, giá cước đơn nhận đủ không chiết khấu.",
      salary: "7.000.000đ - 12.000.000đ",
      companyName: "PawBook Express Delivery",
      niche: "OTHERS",
      latitude: 21.0264,
      longitude: 105.8502,
      ai_tags: "delivery, food-shipper, quick-service, mapping",
    },
    {
      title: "Chuyển nhà sinh viên giá rẻ",
      description: "Nhóm chuyển trọ sinh viên tụi em nhận đóng gói hộp carton, bốc xếp tủ giường, chở đồ đạc giá cực kỳ hạt dẻ hỗ trợ các bạn học sinh sinh viên. Cam kết làm việc nhanh nhẹn, giữ gìn đồ đạc cẩn thận không lo hư hỏng hay thất lạc nha các bạn ơi.",
      salary: "300.000đ - 800.000đ / ngày",
      companyName: "Đội Vận Chuyển Tình Nguyện",
      niche: "OTHERS",
      latitude: 21.0315,
      longitude: 105.8567,
      ai_tags: "packing, moving-helper, student-price, labor",
    },

    // 2. Thợ thuyền & Sửa chữa (5 jobs)
    {
      title: "Sửa chữa điện lạnh tận nhà",
      description: "Chia sẻ bà con cách nhận biết máy lạnh bị thiếu gas. Nếu thấy cục nóng kêu to mà gió trong phòng không thấy lạnh thì alo em qua kiểm tra sửa chữa tận nhà nhé, cam kết báo đúng bệnh lấy đúng giá sinh viên.",
      salary: "12.000.000đ - 20.000.000đ",
      companyName: "Điện Lạnh Bách Khoa",
      niche: "MECHANIC",
      latitude: 10.7761,
      longitude: 106.7042,
      ai_tags: "air-conditioning, fridge-repair, electronics, technician",
    },
    {
      title: "Thợ hàn xì mái tôn nhà phố",
      description: "Mùa mưa đến rồi, nhà bác nào bị dột mái tôn, xệ cửa sắt hay muốn làm thêm lan can sắt bảo vệ ban công thì cứ nhắn tin cho em. Em thợ hàn cơ khí nhiều năm kinh nghiệm, làm việc tỉ mỉ bền đẹp, bảo hành dột mái chu đáo cho cả nhà yên tâm.",
      salary: "10.000.000đ - 15.000.000đ",
      companyName: "Cơ Khí Dân Dụng Tiến Phát",
      niche: "MECHANIC",
      latitude: 21.0253,
      longitude: 105.8589,
      ai_tags: "welding, steel-structure, ironwork, maintenance",
    },
    {
      title: "Sửa điện nước 24/7 khẩn cấp",
      description: "Chập cháy điện âm tường hay rò rỉ nước ngầm luôn là nỗi ám ảnh ban đêm. Đội thợ điện nước tụi em túc trực 24/7 khẩn cấp, gọi là có mặt sau 15 phút xử lý triệt để sự cố cho bà con sinh hoạt bình thường.",
      salary: "11.000.000đ - 17.000.000đ",
      companyName: "Dịch Vụ Nước Sạch 24H",
      niche: "MECHANIC",
      latitude: 10.7798,
      longitude: 106.6953,
      ai_tags: "plumbing, electrical, emergency-repair, piping",
    },
    {
      title: "Cứu hộ xe máy/ô tô bị ngập nước",
      description: "Góc cứu hộ đường phố: Đường ngập nước xe chết máy giữa chừng, ô tô hết bình ắc quy dọc đường... gọi ngay đội cứu hộ tụi em. Có xe cẩu kéo về gara sửa chữa hoặc xử lý tại chỗ sấy khô động cơ lấy liền cho anh em đi tiếp.",
      salary: "15.000.000đ - 25.000.000đ",
      companyName: "Gara Cứu Hộ Sài Gòn",
      niche: "MECHANIC",
      latitude: 21.0278,
      longitude: 105.8522,
      ai_tags: "roadside-assistance, car-tow, engine-drying, mechanic",
    },
    {
      title: "Thợ hàn inox & cửa nhôm kính",
      description: "Bên em chuyên gia công lắp đặt cửa nhôm kính xingfa, tủ bếp inox, vách ngăn kính cường lực cho các shop thời trang, quán cafe mặt phố. Thi công nhanh gọn đẹp mắt, giá cả cạnh tranh nhất thị trường.",
      salary: "9.000.000đ - 13.000.000đ",
      companyName: "Nhôm Kính Thành Đạt",
      niche: "MECHANIC",
      latitude: 10.7753,
      longitude: 106.7018,
      ai_tags: "glass-fitting, aluminum, welding, doors-installation",
    },

    // 3. Dịch vụ gia đình (3 jobs)
    {
      title: "Giúp việc theo giờ căn hộ chung cư",
      description: "Em nhận lau dọn nhà cửa, quét dọn bụi bặm, giặt quần áo và nấu bữa tối gia đình đơn giản theo giờ cho các anh chị bận rộn. Tính em sạch sẽ, trung thực, ngăn nắp nên mọi người hoàn toàn yên tâm giao phó ạ.",
      salary: "50.000đ - 80.000đ / giờ",
      companyName: "HomeCare Maid Agency",
      niche: "OTHERS",
      latitude: 10.7712,
      longitude: 106.6961,
      ai_tags: "housekeeping, cleaning, cooking, laundry",
    },
    {
      title: "Vệ sinh máy lạnh chuyên sâu",
      description: "Bảo dưỡng máy lạnh định kỳ là cách tốt nhất để tiết kiệm điện và bảo vệ sức khỏe gia đình. Em nhận xịt rửa dàn nóng dàn lạnh điều hòa, đo gas và nạp bổ sung gas chuẩn chỉ từ 300k, làm việc sạch sẽ gọn gàng.",
      salary: "300.000đ - 500.000đ / bộ",
      companyName: "CleanAir Việt Nam",
      niche: "MECHANIC",
      latitude: 21.0299,
      longitude: 105.8533,
      ai_tags: "air-con-cleaning, gas-topup, home-maintenance, service",
    },
    {
      title: "Dọn vệ sinh sofa/đệm bằng máy hơi nước",
      description: "Sofa nỉ hay đệm ngủ lâu ngày tích tụ nhiều bụi bẩn và vi khuẩn gây ngứa ngáy. Bên em nhận giặt phun hút sofa, đệm lò xo, thảm trải sàn văn phòng bằng máy hơi nước nóng khử khuẩn sạch bong như mới, không còn mùi ẩm mốc.",
      salary: "8.000.000đ - 11.000.000đ",
      companyName: "Thanh Tẩy Không Gian Sạch",
      niche: "OTHERS",
      latitude: 10.7824,
      longitude: 106.7039,
      ai_tags: "sofa-wash, mattress-cleaning, steam-extraction, sanitize",
    },

    // 4. Làm đẹp & F&B (4 jobs)
    {
      title: "Thợ phụ Spa/Nail chuyên nghiệp",
      description: "Góc tuyển dụng làm đẹp: Tiệm Nail bên em cần tìm thêm các bạn thợ phụ hỗ trợ gội đầu dưỡng sinh, massage mặt và sơn sửa móng cơ bản cho khách. Môi trường làm việc thoải mái, đồng nghiệp vui vẻ hòa đồng lắm nha.",
      salary: "6.000.000đ - 9.000.000đ",
      companyName: "Tiệm Nail Bông Sen",
      niche: "SPA",
      latitude: 10.7766,
      longitude: 106.6999,
      ai_tags: "nail-gel, hair-wash, skincare, customer-relations",
    },
    {
      title: "Tuyển thợ cắt tóc nam/nữ tạo kiểu",
      description: "Salon Bông Sen cần tuyển thợ chính cắt tóc nam nữ tạo kiểu undercut, mohican, uốn nhuộm theo trend. Lương cứng ổn định cộng thêm doanh số dịch vụ hấp dẫn, được đào tạo nâng cao tay nghề thường xuyên.",
      salary: "8.000.000đ - 12.000.000đ + Doanh thu",
      companyName: "Hair Salon Bông Sen",
      niche: "SPA",
      latitude: 21.0245,
      longitude: 105.8519,
      ai_tags: "hair-cut, hair-dyeing, styling, beauty-salon",
    },
    {
      title: "Nhân viên phục vụ Cafe / Trà sữa",
      description: "Quán Cafe Miệt Vườn tuyển nhân viên phục vụ nam nữ ca gãy hoặc xoay ca linh hoạt. Công việc nhẹ nhàng chỉ cần chào đón khách, ghi order đồ uống và bưng bê phục vụ. Môi trường năng động, thích hợp cho sinh viên làm thêm.",
      salary: "4.500.000đ - 6.000.000đ",
      companyName: "Cafe Miệt Vườn",
      niche: "FNB",
      latitude: 10.7725,
      longitude: 106.6934,
      ai_tags: "waiter, waitress, tea-service, menu-ordering",
    },
    {
      title: "Pha chế Cafe máy (Barista) ca gãy",
      description: "Em cần tìm bạn Barista pha chế cafe espresso bằng máy và pha các loại trà trái cây theo công thức định lượng có sẵn. Yêu cầu sạch sẽ, ngăn nắp, biết giữ gìn vệ sinh quầy bar luôn bóng loáng.",
      salary: "6.000.000đ - 8.500.000đ",
      companyName: "Urban Coffee Roasters",
      niche: "FNB",
      latitude: 21.0333,
      longitude: 105.8555,
      ai_tags: "barista, espresso, milk-steaming, counter-cleaning",
    },

    // 5. Giải trí & Thú cưng (3 jobs)
    {
      title: "Cho thuê loa kẹo kéo hát tiệc gia đình",
      description: "Nhà bác nào có tiệc sinh nhật, liên hoan gia đình muốn hát karaoke giải trí thì gọi em nhé. Em cho thuê loa kéo công suất lớn âm thanh cực hay kèm 2 micro không dây hút giọng, giao loa tận nơi và setup miễn phí.",
      salary: "200.000đ - 400.000đ / ngày",
      companyName: "Âm Thanh Sự Kiện Đô Thành",
      niche: "OTHERS",
      latitude: 10.7791,
      longitude: 106.6922,
      ai_tags: "speaker-rental, karaoke, party-setup, delivery",
    },
    {
      title: "Chụp ảnh sự kiện dạo / Ngoại cảnh",
      description: "Bác nào muốn có bộ ảnh kỷ yếu đẹp, ảnh ngoại cảnh cá nhân lung linh hay cần thợ chụp hình tiệc sinh nhật, sự kiện nhỏ thì liên hệ em nha. Máy ảnh cơ chuyên nghiệp, trả file gốc nhanh và hỗ trợ photoshop nhiệt tình.",
      salary: "800.000đ - 1.500.000đ / buổi",
      companyName: "Pixel Studio Việt Nam",
      niche: "OTHERS",
      latitude: 21.0267,
      longitude: 105.8488,
      ai_tags: "photography, camera-operator, photo-editing, events",
    },
    {
      title: "Tắm tỉa lông chó mèo tại nhà khách",
      description: "Dịch vụ spa thú cưng tận nhà: Em nhận cắt móng, vệ sinh tai, tắm sấy thơm tho và cắt tỉa lông tạo kiểu nghệ thuật cho các bé cún, bé mèo cưng của bạn ngay tại nhà, không cần mang đi xa tránh các bé bị stress.",
      salary: "8.000.000đ - 11.000.000đ",
      companyName: "Pet Grooming Mobile",
      niche: "SPA",
      latitude: 10.7749,
      longitude: 106.7058,
      ai_tags: "pet-grooming, dog-bath, cat-haircut, animal-care",
    },
  ];

  console.log("Cleaning up old database listings (Purging jobs, services, reviews)...");
  await prisma.review.deleteMany({});
  await prisma.job.deleteMany({});
  await prisma.service.deleteMany({});
  console.log("Database clean up successful.");

  const cities = [
    { name: "Hà Nội", lat: 21.0285, lng: 105.8542 },
    { name: "TP. Hồ Chí Minh", lat: 10.7626, lng: 106.6602 },
    { name: "Đà Nẵng", lat: 16.0544, lng: 108.2022 },
    { name: "Cần Thơ", lat: 10.0371, lng: 105.7882 },
    { name: "Hải Phòng", lat: 20.8449, lng: 106.6881 },
    { name: "Nha Trang", lat: 12.2388, lng: 109.1967 },
    { name: "Huế", lat: 16.4637, lng: 107.5909 },
    { name: "Đà Lạt", lat: 11.9404, lng: 108.4583 },
    { name: "Vinh", lat: 18.6734, lng: 105.6812 },
    { name: "Buôn Ma Thuột", lat: 12.6853, lng: 108.0383 },
  ];

  /*
  const iterationsCount = 3; // 3 * 20 = 60 items
  console.log(`Crawling and inserting ${mockJobsData.length * iterationsCount} multi-niche jobs & services into Turso...`);

  let insertedCount = 0;
  for (let cycle = 0; cycle < iterationsCount; cycle++) {
    for (let i = 0; i < mockJobsData.length; i++) {
      const jobData = mockJobsData[i];
      const employerId = getRandomEmployer();
      insertedCount++;

      // Pick a random city to assign geographic coordinates spanning Vietnam
      const city = cities[Math.floor(Math.random() * cities.length)];
      // Add slight disperse offset within city limits
      const latOffset = (Math.random() - 0.5) * 0.05;
      const lngOffset = (Math.random() - 0.5) * 0.05;
      const finalLat = city.lat + latOffset;
      const finalLng = city.lng + lngOffset;

      const randomRating = parseFloat((Math.random() * 1.0 + 4.0).toFixed(1)); // 4.0 to 5.0 stars

      // 1. Create Job Listing
      await prisma.job.create({
        data: {
          title: cycle > 0 ? `${jobData.title} (Chi nhánh #${cycle})` : jobData.title,
          description: jobData.description,
          salary: jobData.salary,
          companyName: jobData.companyName,
          employerId: employerId,
          niche: jobData.niche,
          latitude: finalLat,
          longitude: finalLng,
          ai_tags: jobData.ai_tags,
          isBoosted: Math.random() > 0.7,
        },
      });

      // 2. Determine Service Category
      let serviceCategory = "Khác";
      const titleLower = jobData.title.toLowerCase();
      if (jobData.niche === "SPA") serviceCategory = "Spa";
      else if (jobData.niche === "FNB") serviceCategory = "F&B";
      else if (jobData.niche === "MECHANIC") serviceCategory = "Sửa chữa";
      else if (titleLower.includes("xe") || titleLower.includes("vận tải")) serviceCategory = "Vận tải";
      else if (titleLower.includes("giúp việc") || titleLower.includes("sofa") || titleLower.includes("dọn")) serviceCategory = "Gia đình";

      // 3. Create Corresponding Service Listing
      await prisma.service.create({
        data: {
          name: cycle > 0 ? `${jobData.companyName} (Cơ sở #${cycle})` : jobData.companyName,
          category: serviceCategory,
          description: jobData.description,
          location: `${city.name}, Việt Nam`,
          city: city.name,
          contactInfo: "0987.654.321",
          imageUrl: `https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&auto=format&fit=crop&q=60`,
          priceRange: "200.000đ - 1.500.000đ",
          rating: randomRating,
          ownerId: employerId,
          isBoosted: Math.random() > 0.7,
        },
      });

      console.log(`[${insertedCount}/${mockJobsData.length * iterationsCount}] Inserted Job & Service: ${jobData.title} in ${city.name} (${jobData.niche} / ${serviceCategory})`);
    }
  }
  */
  console.log("Mock Crawler script ran with inserts disabled.");
}

main()
  .catch(err => {
    console.error("Mock Crawler failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
