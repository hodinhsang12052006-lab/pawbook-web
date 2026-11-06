import { notFound } from "next/navigation";

// Mọi URL trang KHÔNG khớp route nào dưới /en|/vi (vd. /this-page-does-not-exist → rewrite /en/this-page-does-not-exist)
// dừng ở đây và gọi notFound() → Next render app/[lang]/not-found.tsx BÊN TRONG layout [lang]: font app (--font-pn),
// nền mận, dock cho người đã đăng nhập, đúng ngôn ngữ — như trang 404 trong app trước khi chuyển sang app/[lang].
// app/global-not-found.tsx chỉ còn cho URL nằm ngoài cây ngôn ngữ (vd. đường dẫn có đuôi tệp không tồn tại).
// Route tĩnh / động cụ thể hơn (/jobs/create, /jobs/[id]…) luôn thắng catch-all này.
// force-dynamic: layout [lang] đặt dynamicParams = false — catch-all tĩnh sẽ bị trả 404 ngay ở tầng router
// (global-not-found), không qua not-found.tsx của [lang].
export const dynamic = "force-dynamic";

export default function MissingPage(): never {
  notFound();
}
