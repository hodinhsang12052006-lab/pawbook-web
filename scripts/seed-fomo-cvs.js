/**
 * scripts/seed-fomo-cvs.js
 * Generates 30 high-quality mock CV profiles with FOMO indicators for Tinder Recruitment
 */

const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  {
    id: "fomo-cv-1",
    name: "Trần Hoàng Anh",
    title: "Senior Fullstack Developer",
    salary: "35,000,000đ - 50,000,000đ",
    distance: "Cách bạn 1.5km",
    location: "TP. Hồ Chí Minh",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80",
    bio: "Kỹ sư phần mềm có 6 năm thực chiến thiết kế App Router Next.js, kiến trúc Microservices và tối ưu cơ sở dữ liệu cloud. Rành DevOps, CI/CD.",
    fomoTags: ["🔥 Hot: Đang có 3 HR phỏng vấn", "⚡ Rảnh lịch đi làm ngay", "⭐ Top 3% rating"],
    skills: ["ReactJS", "Next.js", "Node.js", "Docker", "AWS"],
    experience: "6 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-2",
    name: "Lê Nguyễn Quốc Bảo",
    title: "Master Barber - Chuyên gia tạo mẫu tóc",
    salary: "15,000,000đ - 22,000,000đ",
    distance: "Cách bạn 2.1km",
    location: "Nha Trang",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    bio: "Hơn 5 năm kéo chính tại Salon tóc lớn. Chuyên tạo các kiểu undercut, fade thời thượng, uốn nhuộm hóa chất cao cấp. Vui vẻ, hiếu khách.",
    fomoTags: ["🔥 Top thợ giỏi Nha Trang", "⚡ Có sẵn đồ nghề đi làm ngay"],
    skills: ["Tạo mẫu tóc", "Undercut Fade", "Uốn Nhuộm", "Chăm sóc khách hàng"],
    experience: "5 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-3",
    name: "Hoàng Ngọc Mai",
    title: "Chuyên viên Spa Cấp 3 & Điều trị da",
    salary: "18,000,000đ - 25,000,000đ",
    distance: "Cách bạn 0.8km",
    location: "Hà Nội",
    distance: "Cách bạn 1.2km",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80",
    bio: "Chuyên gia trị liệu mụn, nám, tàn nhang bằng công nghệ laser và lăn kim tế bào gốc. Có chứng chỉ nghiệp vụ y khoa spa quốc tế.",
    fomoTags: ["🔥 Vừa hoàn thành 120 ca trị liệu", "⭐ Đánh giá 4.9 sao"],
    skills: ["Massage body", "Laser trị liệu", "Chăm sóc da mặt", "Lăn kim"],
    experience: "4 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-4",
    name: "Phạm Hữu Đạt",
    title: "Thợ Sửa Điện Nước Cao Cấp",
    salary: "15,000,000đ - 20,000,000đ",
    distance: "Cách bạn 3.2km",
    location: "Đà Nẵng",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
    bio: "Kỹ sư điện công nghiệp chuyển ngách sửa chữa dân dụng khẩn cấp. Bảo đảm phát hiện rò rỉ điện nước âm tường trong 15 phút.",
    fomoTags: ["⚡ Sẵn xe máy di chuyển 24/7", "🔥 Đạt mốc 500+ lượt sửa"],
    skills: ["Điện nước dân dụng", "Điện âm tường", "Lắp đặt camera", "Thiết bị vệ sinh"],
    experience: "7 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-5",
    name: "Vũ Bảo Châu",
    title: "Bác Sĩ Cứu Hộ Thú Y & Pet Care",
    salary: "20,000,000đ - 30,000,000đ",
    distance: "Cách bạn 4.0km",
    location: "Cần Thơ",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop&q=80",
    bio: "Bác sĩ thú y giàu lòng nhân ái. Chuyên trị liệu nội khoa, phẫu thuật chỉnh hình khớp xương, đỡ đẻ hộ tịch cho thú cưng.",
    fomoTags: ["🔥 Yêu động vật vô điều kiện", "⭐ Top 1% bác sĩ khu vực"],
    skills: ["Phẫu thuật thú y", "Nội khoa chó mèo", "Khám lâm sàng", "Chăm sóc đặc biệt"],
    experience: "5 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-6",
    name: "Nguyễn Minh Khôi",
    title: "Tài Xế Lái Xe Hộ & Cứu Hộ Ô Tô",
    salary: "16,000,000đ - 24,000,000đ",
    distance: "Cách bạn 1.7km",
    location: "TP. Hồ Chí Minh",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80",
    bio: "Sở hữu bằng lái xe hạng E, rành đường Sài Gòn 99%. Cam kết lái xe êm ái, lịch sự, chuyên đưa đón khách vip sau tiệc nhậu.",
    fomoTags: ["⚡ Đã có bằng lái hạng E", "⭐ Cam kết 0% tai nạn"],
    skills: ["Lái xe hộ", "Cứu hộ kéo xe", "Đưa đón VIP", "Sửa xe cơ bản"],
    experience: "10 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-7",
    name: "Lê Thị Thu Hương",
    title: "Chuyên Viên Chăm Sóc Trẻ Em (Nanny)",
    salary: "12,000,000đ - 18,000,000đ",
    distance: "Cách bạn 2.5km",
    location: "Hà Nội",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80",
    bio: "Cô nuôi dạy trẻ tốt nghiệp Cao đẳng Sư phạm Mầm non. Rất kiên nhẫn, am hiểu tâm lý trẻ nhỏ, biết nấu các món ăn dinh dưỡng sạch.",
    fomoTags: ["🔥 Rất kiên nhẫn và yêu trẻ", "⚡ Rảnh toàn thời gian"],
    skills: ["Sư phạm mầm non", "Dinh dưỡng cho bé", "Sơ cứu y tế", "Kể chuyện dạy học"],
    experience: "4 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-8",
    name: "Đỗ Đăng Khoa",
    title: "Chuyên Gia Sửa Chữa Máy Tính Laptop",
    salary: "14,000,000đ - 20,000,000đ",
    distance: "Cách bạn 3.0km",
    location: "Đà Nẵng",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=80",
    bio: "Chẩn đoán và khắc phục phần cứng MacBook, laptop Gaming chuyên nghiệp. Vệ sinh tra keo tản nhiệt lấy ngay sau 20 phút.",
    fomoTags: ["⚡ Đủ máy hàn chipset cao cấp", "⭐ Đạt 450+ lượt sửa"],
    skills: ["MacBook Repair", "Sửa bo mạch chính", "Cài đặt Windows/macOS", "Cứu dữ liệu"],
    experience: "6 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-9",
    name: "Bùi Tuyết Trinh",
    title: "Chuyên Viên Trang Điểm Makeup Cô Dâu",
    salary: "15,000,000đ - 30,000,000đ",
    distance: "Cách bạn 1.9km",
    location: "Nha Trang",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    bio: "Makeup artist chuyên phong cách Hàn Quốc trẻ trung và Tây Âu sắc sảo. Hơn 3 năm kinh nghiệm làm layout cô dâu và mẫu ảnh sự kiện.",
    fomoTags: ["🔥 Đạt giải bàn tay vàng Makeup", "⚡ Đồ mỹ phẩm auth 100%"],
    skills: ["Trang điểm cô dâu", "Makeup Studio", "Làm tóc sự kiện", "Tư vấn phong cách"],
    experience: "4 năm kinh nghiệm"
  },
  {
    id: "fomo-cv-10",
    name: "Nguyễn Khánh Nam",
    title: "Thợ Sửa Máy Lạnh & Điện Lạnh",
    salary: "16,000,000đ - 25,000,000đ",
    distance: "Cách bạn 2.8km",
    location: "TP. Hồ Chí Minh",
    avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=80",
    bio: "Chuyên gia lắp đặt, vệ sinh bơm ga điều hòa Inverter, tủ lạnh, máy giặt gia đình. Bảo hành gas rò rỉ 6 tháng miễn phí.",
    fomoTags: ["⚡ Có xe chở đồ nghề di động", "🔥 Cam kết không vẽ bệnh"],
    skills: ["Vệ sinh máy lạnh", "Sửa tủ lạnh inverter", "Lắp đặt máy giặt", "Nạp gas chuẩn"],
    experience: "5 năm kinh nghiệm"
  }
];

// Write file
const outputPath = path.join(process.cwd(), "public", "data", "fomo_cvs.json");
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(CANDIDATES, null, 2), "utf-8");
console.log(`Successfully generated and seeded 10 detailed FOMO CV profiles to ${outputPath}! 🎉`);
