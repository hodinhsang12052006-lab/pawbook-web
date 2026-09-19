// Pure helper — no SDK import, safe to pull into both server and client
// bundles. Every server-side trigger() MUST target this same channel name,
// or the event is sent to a channel nobody is listening on and silently
// disappears (this was previously the case for new-message/message-updated/
// call signaling, which triggered to the bare user id instead).
export const chatChannelName = (userId: string) => `private-chat-${userId}`;
