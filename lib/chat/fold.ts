// Bỏ dấu tiếng Việt + chữ thường để tìm "nguyen" ra "Nguyễn", "cam on" ra "cảm ơn". THUẦN (dùng được ở máy chủ / test).
export const foldVi = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
