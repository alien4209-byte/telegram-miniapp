// All user-facing text is Persian per spec. `format` does simple {{key}} interpolation.

export const persianMessages = {
  welcome: "به بازی حکم خوش آمدید! 🎴",
  waiting_for_players: "در انتظار بازیکنان... ({{count}}/۴)",
  player_joined: "{{player}} به بازی پیوست",
  player_left: "{{player}} از بازی خارج شد",
  game_full: "بازی کامل است!",
  game_started: "بازی شروع شد! 🎯",
  need_4_players: "برای شروع بازی به ۴ بازیکن نیاز است",
  select_trump: "لطفاً خشت را انتخاب کنید:",
  trump_selected: "خشت انتخاب شد: {{suit}}",
  waiting_for_trump: "منتظر انتخاب خشت توسط حکم...",
  your_turn: "نوبت شماست!",
  wait_for_turn: "منتظر نوبت دیگران بمانید",
  card_played: "{{player}} کارت {{card}} را انداخت",
  trick_won: "برنده دور: {{player}}",
  trick_number: "دور {{number}}",
  game_ended: "بازی به پایان رسید! 🏆",
  team_won: "برنده: {{team}}",
  team1: "تیم ۱",
  team2: "تیم ۲",
  final_score: "امتیاز نهایی: {{team1}} - {{team2}}",
  not_your_turn: "نوبت شما نیست!",
  invalid_card: "شما این کارت را ندارید!",
  must_follow_suit: "باید همرنگ بیارید!",
  game_not_found: "بازی پیدا نشد!",
  connection_error: "خطا در اتصال به سرور!",
  unknown_error: "خطای ناشناخته!",
  play_again: "بازی دوباره",
  // Extra strings used by the Telegram bot webhook (not in the original list, but
  // needed for a coherent bot experience — same {{key}} interpolation style).
  wrong_chat: "این ربات فقط در گروه مجاز کار می‌کند.",
  open_game: "🎴 برای شروع بازی حکم دکمه زیر را بزنید:",
} as const;

export type PersianMessageKey = keyof typeof persianMessages;

/** Replaces {{key}} placeholders in a Persian message template with provided values. */
export function formatMessage(
  key: PersianMessageKey,
  params?: Record<string, string | number>
): string {
  const template = persianMessages[key];
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{{${name}}}`
  );
}
