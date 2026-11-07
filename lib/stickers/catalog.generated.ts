// ĐỪNG SỬA TAY — sinh bởi scripts/stickers/build_manifest.mjs (mọi emoji động Noto còn lại, nối vào cuối từng bộ hoạt hình, xếp theo độ phổ biến).
// Noto Emoji Animation (Google) · CC BY 4.0 · Microsoft Fluent Emoji (3D) · MIT · Unicode CLDR 49.0.0 · Unicode License v3 — xem NOTICE.
export const NOTO_VERSION = "17.0";

/** id bộ → các id nối thêm (cách nhau 1 dấu cách) */
export const NOTO_FILL_ITEMS: Record<string, string> = {
  "feelings": "😀 😃 😄 😁 😆 😗 😙 😚 🙃 🙂 ☺️ 😌 🙂‍↕️ 🙂‍↔️ 😛 😝 🫪 😔 😑 😐 😶 😶‍🌫️ 🫥 🤐 🤫 🫢 🤨 🧐 😒 😮‍💨 😠 🤬 😞 😓 😟 😥 😢 ☹️ 🙁 🫤 😕 😰 😨 😧 😦 😯 😲 😖 😣 😩 😫 😵 🫨 🥴 🤢 🤮 🫩 😪 🤒 🤕 🤥 🤠 🤑 🤓 🥸 🤡 💩 👿 👻 🤖 👹 ☃️ ⛄ 👽 👾 🌚 🌝 🌞 🌛 🌜 😸 😼 😽 🙀 😿 😾 🙉 🙊 ⚡ 🫯 🕳️ 💌 🫆 🩸 🦠",
  "hands": "🫂 🗣️ 👣 🧠 🦴 👁️ 🫦 👃 👂 🦻 🦶 🦵 🦿 🦾 👐 🤲 🤜 🤛 ✊ 👊 🫳 🫴 🫱 🫲 🫸 🫷 🤚 🖐️ ✋ 🖖 🤟 🤘 🤏 👉 👈 👆 👇 🖕 🤳 🪂 🫈",
  "hearts": "🩵 🤎 🩶 💗 💓 💟 ♥️ ❣️ ❤️‍🩹 🫀",
  "party": "🪔 🥈 🥉 ⚽ ⚾ 🥎 🏀 🏉 🎾 🏸 🥍 🏏 🏑 🏒 🎿 ⛸️ 🛼 🩰 🛹 ⛳ 🎯 🥏 🪃 🪁 🎣 🥋 🎱 🏓 🎳 ♟️ 🎲 🎰 🪄 📷 🫟 🎷 🎺 🪊 🎸 🪕 🎻 🪉 🥁 🪇 📺 🎞️ 🎬 🎭 🎟️",
  "animals": "🥀 🪷 🪻 🌼 🍂 🍁 🍄 🌿 🌱 🍃 🌵 🪾 🌲 🪨 🛘 🌋 🏞️ 🌅 🌄 🌊 🌬️ ❄️ 🌀 🌪️ 💧 ☁️ 🌧️ 🌩️ ⛅ 🪐 🌍 🌎 🌏 🌌 ☄️ 🐺 🐮 🦎 🦖 🦕 🐊 🐍 🐸 🐇 🐀 🐩 🦮 🐕‍🦺 🐖 🐎 🫏 🐂 🐐 🦥 🐅 🐒 🦍 🦧 🐿️ 🦝 🦔 🦦 🦇 🐦 🐦‍⬛ 🐓 🐤 🦅 🕊️ 🪿 🦩 🦚 🐦‍🔥 🦭 🦈 🫍 🐟 🐡 🦞 🦀 🪼 🦂 🕷️ 🐜 🦗 🦟 🪳 🪰 🐞 🐛 🪱",
  "food": "🍒 🍎 🍅 🍊 🥕 🥭 🍍 🌽 🍋 🍈 🍐 🫛 🥬 🫑 🥝 🥦 🥒 🫐 🍇 🫜 🥔 🧅 🫚 🧄 🫘 🍞 🥞 🍳 🧀 🥓 🍗 🌭 🥨 🌯 🍝 🥗 🍢 🍡 🍨 🥧 🧂 🧃 🍼 🍵 🫖 🧉 🍻 🫗 🍹 🥢 🍽️",
  "travel": "🛑 🚧 🚨 ⛽ 🛟 ⚓ 🚦 🚲 🏍️ 🚚 🚜 🏎️ 🚕 🚌 🚂 ⛵ 🛶 🛸 🛫 🛬 🎢 🎡 🎠 🗿 🏚️ 🏕️ 🌇",
  "objects": "📟 🔌 🔋 🪫 💿 💻 🖨️ 🪎 🪙 ⚖️ 🛒 🧹 🧦 🪭 ☂️ 👠 👟 🌡️ 🩺 🛠️ 🪏 ⚙️ ⛓️‍💥 ⛓️ 🖇️ ✂️ ✏️ 📚 📊 📈 📉 🗑️ 📦 🗳️ ⌛ ⏳ 🛎️ 🔔 📣 🔎 🔮 💣 🪤 🔒",
  "symbols": "♠️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ 🗯️ ⁉️ ‼️ ❌ 🆘 ♨️ 📴 ☢️ ☣️ ⚠️ 🆓 🆙 🚮 ☮️ ☯️ ➕ ©️ ®️ ™️ 🏁 🚩 🏴 🏳️",
};
