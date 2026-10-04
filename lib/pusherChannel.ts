// Pure helper — no SDK import, safe to pull into both server and client
// bundles. Every server-side trigger() MUST target this same channel name,
// or the event is sent to a channel nobody is listening on and silently
// disappears (this was previously the case for new-message/message-updated/
// call signaling, which triggered to the bare user id instead).
export const chatChannelName = (userId: string) => `private-chat-${userId}`;

// Kênh CÔNG KHAI báo "tin tuyển gấp" theo bang — chỉ chứa thông tin vốn đã
// công khai trên job board (tiêu đề, tiệm, thành phố, lương), nên không cần
// xác thực. Thợ cùng bang subscribe để nhận ngay khi có tiệm cần người.
export const jobAlertChannelName = (market: string, state: string): string | null =>
  /^(US|AU)$/.test(market) && /^[A-Z]{2,4}$/.test(state) ? `jobs-${market}-${state}` : null;
