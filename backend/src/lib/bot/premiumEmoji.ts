/** Premium custom emoji via HTML parse mode: <tg-emoji emoji-id="...">fallback</tg-emoji> */
export function tgPremiumEmoji(fallback: string, emojiId: string): string {
  return `<tg-emoji emoji-id="${emojiId}">${fallback}</tg-emoji>`;
}

export const DEPOSIT_ASSET_EMOJI = {
  trx: { fallback: "🪙", id: "5832692572971077565" },
  usdt: { fallback: "🪙", id: "5832577678300943429" },
  bnb: { fallback: "🪙", id: "5829978819359937589" },
  matic: { fallback: "🪙", id: "5830130569144439663" },
  gram: { fallback: "💎", id: "5834757434333208303" },
} as const;

/** Toman / rial gateway deposit notify */
export const TOMAN_DEPOSIT_EMOJI = {
  fallback: "💸",
  id: "5783135105711084620",
} as const;

export const DEPOSIT_UI_EMOJI = {
  monitor: { fallback: "🖥", id: "5282843764451195532" },
  hash: { fallback: "🔗", id: "5271604874419647061" },
  miniapp: { fallback: "🎮", id: "5361741454685256344" },
} as const;

/** Merchant shop approve / reject bot notify */
export const SHOP_REVIEW_EMOJI = {
  approved: { fallback: "✔️", id: "5206607081334906820" },
  rejected: { fallback: "🚫", id: "5240241223632954241" },
  monitor: { fallback: "🖥", id: "5282843764451195532" },
  question: { fallback: "❓", id: "5436113877181941026" },
  speak: { fallback: "🗣️", id: "5460795800101594035" },
  miniapp: { fallback: "🎮", id: "5361741454685256344" },
} as const;

/** /start language picker + welcome + settings */
export const START_UI_EMOJI = {
  eyes: { fallback: "👀", id: "5210956306952758910" },
  globe: { fallback: "🌐", id: "5447410659077661506" },
  thumbsUp: { fallback: "👍", id: "5337080053119336309" },
  money: { fallback: "💸", id: "5231005931550030290" },
  down: { fallback: "⬇️", id: "5406745015365943482" },
  miniapp: { fallback: "🎮", id: "5361741454685256344" },
  settings: { fallback: "⚙️", id: "5341715473882955310" },
  support: { fallback: "💬", id: "5443038326535759644" },
  monitor: { fallback: "🖥", id: "5282843764451195532" },
} as const;

/** Flag icons for glass language buttons */
export const LANG_FLAG_EMOJI = {
  en: { fallback: "🇺🇸", id: "5294244076533600593" },
  zh: { fallback: "🇨🇳", id: "5294068833277990704" },
  fa: { fallback: "🇮🇷", id: "5805429031109137606" },
  de: { fallback: "🇩🇪", id: "5292013274815028523" },
  ru: { fallback: "🇷🇺", id: "5294335323113807278" },
  ar: { fallback: "🇸🇦", id: "5294163983983463099" },
} as const;

export type DepositAssetEmojiKey = keyof typeof DEPOSIT_ASSET_EMOJI;
export type BotLangCode = keyof typeof LANG_FLAG_EMOJI;
