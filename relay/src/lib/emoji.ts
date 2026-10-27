export const EMOJI_GROUPS = [
  { id: "faces", icon: "🙂", keywords: "face smile happy laugh love heart people лицо улыбка смех любовь люди", values: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😍 🥰 😘 😋 😛 😜 🤪 😎 🤓 🧐 🤩 🥳 😏 😌 😔 😴 🤤 😑 😐 😶 🫠 🤔 🤨 😮 😯 😲 😳 🥺 😢 😭 😤 😠 😡 🤯 😱 😨 😰 🤗 🫡 🤫 🤭 🥱 🤐 🤥 😇 🤠 😈 👻 🤖 💩 👀 👋 🤚 🖐️ ✋ 🖖 🫶 👍 👎 👊 ✊ 🤛 🤜 🤞 ✌️ 🤟 🤘 👌 🤌 🤏 👏 🙌 👐 🤲 🙏 💪 🧠 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 💕 💖 💗 💘 💝" },
  { id: "nature", icon: "🌿", keywords: "animal nature flower cat dog plant tree животное природа цветок кот собака растение", values: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🦋 🐝 🐞 🐢 🐍 🐙 🐬 🐳 🐟 🦀 🦐 🐘 🦒 🦓 🐎 🐈 🐕 🌱 🌿 🍀 🌲 🌳 🌴 🌵 🌷 🌹 🌻 🌼 🌸 🌺 🍁 🍂 🍃 ☀️ 🌙 ⭐ 🌟 🌈 🔥 💧 ❄️ ☁️ ⚡" },
  { id: "food", icon: "🍕", keywords: "food drink coffee fruit cake еда напиток кофе фрукты торт", values: "🍎 🍏 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥕 🌽 🥔 🍞 🥐 🥖 🧀 🍳 🥞 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🍣 🍜 🍝 🍿 🍦 🍰 🎂 🍪 🍩 🍫 🍬 🍭 ☕ 🍵 🥤 🧋 🍺 🥂 🍷" },
  { id: "activity", icon: "⚽", keywords: "activity sport celebrate party music game работа спорт праздник музыка игра", values: "🎉 🎊 🎈 🎁 🎀 🏆 🥇 🥈 🥉 ⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🏸 🥊 🎯 🎮 🎲 🧩 🎨 🎬 🎤 🎧 🎼 🎹 🎸 🥁 🎻 📷 🎭 🏃 🚴 🏊 🧘" },
  { id: "travel", icon: "✈️", keywords: "travel car transport place home rocket путешествие транспорт дом ракета", values: "🚀 🛸 ✈️ 🚁 🚂 🚆 🚇 🚉 🚗 🚕 🚌 🚎 🚓 🚑 🚒 🚚 🚲 🛴 🛵 🏍️ 🚢 ⛵ ⚓ 🏠 🏡 🏢 🏙️ 🌍 🌎 🌏 🗺️ 🏔️ 🏕️ 🏖️ 🏝️ 🗽 🗼 🏰" },
  { id: "objects", icon: "💡", keywords: "object work tool idea book computer light предмет работа инструмент идея книга компьютер лампа", values: "💡 🔦 🕯️ 📱 💻 🖥️ ⌨️ 🖱️ 🖨️ 📚 📖 📕 📗 📘 📙 📝 ✏️ 🖊️ 📌 📍 📎 🗂️ 📁 📂 📅 🗓️ ⏰ ⏱️ ⌛ 🔎 🔍 🔐 🔒 🔓 🔑 🛠️ 🔧 🔨 ⚙️ 🧪 🔬 💊 💎 💰 💳 📦 ✉️ 📮" },
  { id: "symbols", icon: "✅", keywords: "symbol yes no check warning star heart знак да нет галочка предупреждение звезда", values: "✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 💯 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔶 🔷 🔺 🔻 🔸 🔹 ⭕ 🚫 ⚠️ ❗ ❓ ⁉️ ‼️ 💬 💭 🔔 🔕 🏁 🚩 🏳️ 🏴 🔄 ♻️ 🔗 ↗️ ↘️ ⬆️ ⬇️ ⬅️ ➡️" },
] as const;
export const EMOJI_VALUES = new Set(EMOJI_GROUPS.flatMap((g) => g.values.split(" ")));
export type CustomEmoji = { id: string; name: string; data: string; type: "image/png" };

// Specific aliases take precedence over category search terms.
const EMOJI_ALIASES: [string, string][] = [
  ["😀 😃 😄 😁 😊 🙂", "smile happy happy face улыбка радость"], ["😆 😅 😂 🤣", "laugh lol laughing смех смеяться"],
  ["😍 🥰 😘 😗 😙 😚", "love kiss любовь поцелуй"], ["😢 😭", "cry sad tears грусть слезы плач"], ["😠 😡 🤬", "angry mad злость"],
  ["😎", "cool sunglasses круто очки"], ["🤔", "thinking think думать мысль"], ["🥳 🎉 🎊", "party celebrate celebration праздник поздравления"],
  ["😴 💤", "sleep sleeping сон спать"], ["👋", "wave hello привет"], ["👍", "thumbs up like yes лайк да"], ["👎", "thumbs down dislike no дизлайк нет"],
  ["👏", "clap applause аплодисменты"], ["🙏", "thanks please pray спасибо пожалуйста"], ["💪", "strong muscle сила"], ["🤝", "handshake deal рукопожатие"],
  ["❤️ 💙 💚 💛 💜 🖤 🤍 🤎 🧡 💖 💕 💗", "heart love сердце любовь"], ["🔥", "fire hot огонь"], ["✅ ✔️", "check done yes готово галочка"],
  ["❌", "cross no cancel отмена нет крест"], ["⚠️", "warning caution внимание предупреждение"], ["⭐ 🌟 ✨", "star sparkle звезда"], ["💯", "hundred perfect сто идеально"],
  ["🐱 🐈", "cat kitten кот кошка"], ["🐶 🐕", "dog puppy собака щенок"], ["🐭 🐁", "mouse мышь"], ["🐰 🐇", "rabbit bunny заяц кролик"],
  ["🦊", "fox лиса"], ["🐻", "bear медведь"], ["🐼", "panda панда"], ["🐯 🐅", "tiger тигр"], ["🦁", "lion лев"], ["🐮 🐄", "cow корова"],
  ["🐷 🐖", "pig свинья"], ["🐸", "frog лягушка"], ["🐵 🐒", "monkey обезьяна"], ["🐔 🐓", "chicken rooster курица петух"], ["🐧", "penguin пингвин"],
  ["🐦 🦜", "bird parrot птица попугай"], ["🦉", "owl сова"], ["🦋", "butterfly бабочка"], ["🐝", "bee пчела"], ["🐞", "ladybug божья коровка"],
  ["🐢", "turtle черепаха"], ["🐍", "snake змея"], ["🐙", "octopus осьминог"], ["🐬", "dolphin дельфин"], ["🐟 🐠", "fish рыба"],
  ["🐘", "elephant слон"], ["🦒", "giraffe жираф"], ["🌹 🌷 🌸 🌺 🌻 🌼", "flower flowers цветок цветы"], ["🌲 🌳 🌴", "tree дерево"],
  ["🍀 ☘️", "clover luck клевер удача"], ["🌙", "moon луна"], ["☀️", "sun солнце"], ["🌈", "rainbow радуга"], ["❄️", "snow snowflake снег снежинка"],
  ["🍎 🍏", "apple яблоко"], ["🍌", "banana банан"], ["🍓", "strawberry клубника"], ["🍉", "watermelon арбуз"], ["🍒", "cherry вишня"],
  ["🍕", "pizza пицца"], ["🍔", "burger бургер"], ["🍟", "fries картошка фри"], ["🍣", "sushi суши"], ["🍰 🎂", "cake birthday торт день рождения"],
  ["☕", "coffee tea кофе чай"], ["🍺 🍻", "beer пиво"], ["🍷", "wine вино"], ["⚽", "football soccer футбол"], ["🏀", "basketball баскетбол"],
  ["🏆 🥇", "trophy win winner кубок победа"], ["🎮", "game gaming игра"], ["🎵 🎶 🎸", "music музыка"], ["🎁", "gift present подарок"],
  ["🚗 🚙", "car машина"], ["✈️ 🛫", "plane airplane flight самолет полет"], ["🚀", "rocket ракета"], ["🏠 🏡", "home house дом"],
  ["💡", "idea lightbulb идея лампочка"], ["💻 🖥️", "computer laptop компьютер ноутбук"], ["📚 📖", "book books книга книги"], ["🔗", "link ссылка"],
  ["🔒 🔐", "lock security замок безопасность"], ["📎", "paperclip attach скрепка вложение"], ["📅 🗓️", "calendar date календарь дата"], ["⏰ ⏱️", "clock time часы время"],
];
export const EMOJI_KEYWORDS = new Map(EMOJI_ALIASES.flatMap(([values, words]) => values.split(" ").map((value) => [value, words] as const)));
