-- Hoạ tiết của mẫu nail (French, ombre, tim, hoa…) để app tự vẽ minh hoạ đúng hoạ tiết.
-- Thêm cột, không đụng dữ liệu cũ (mặc định "solid" = màu trơn).
ALTER TABLE "NailDesign" ADD COLUMN "pattern" TEXT NOT NULL DEFAULT 'solid';
