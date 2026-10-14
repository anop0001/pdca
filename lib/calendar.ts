/**
 * スマホ標準カレンダー（Googleカレンダー / iOSカレンダー / iCal）と
 * 連携して完全無料（0円）でリマインダー・アラーム通知を登録するためのユーティリティ
 */

export interface CalendarEventOptions {
  title: string;
  description?: string;
  deadlineDate: string; // 'YYYY-MM-DD'
  appUrl?: string;
}

/**
 * Googleカレンダー登録用のWeb URLを生成
 */
export function getGoogleCalendarUrl(options: CalendarEventOptions): string {
  const { title, description, deadlineDate, appUrl } = options;
  
  // 日付文字列のパース（YYYY-MM-DD）
  const parts = deadlineDate.split('-');
  const y = parts[0] || '2026';
  const m = parts[1] || '01';
  const d = parts[2] || '01';
  
  // 終日イベント: 開始日と終了日(翌日)
  const startDateStr = `${y}${m}${d}`;
  const nextDate = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const ny = nextDate.getFullYear();
  const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
  const nd = String(nextDate.getDate()).padStart(2, '0');
  const endDateStr = `${ny}${nm}${nd}`;

  const eventTitle = `【PDCA評価期日】${title}`;
  const eventDetails = [
    description || '目標のPDCA評価締め切り日です。実績を確認して次のActionを決めましょう！',
    '',
    `▼PDCAアプリを開いて確認・改訂:`,
    appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://pdca-mauve.vercel.app/'),
  ].join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle,
    details: eventDetails,
    dates: `${startDateStr}/${endDateStr}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * iPhone / Mac / Windows / Android用 .ics カレンダーファイルを生成
 * - 締め切り前日の朝9:00および当日朝9:00にアラーム通知（VALARM）を自動設定
 */
export function generateIcsContent(options: CalendarEventOptions): string {
  const { title, description, deadlineDate, appUrl } = options;
  const parts = deadlineDate.split('-');
  const y = parts[0] || '2026';
  const m = parts[1] || '01';
  const d = parts[2] || '01';

  const startDateStr = `${y}${m}${d}`;
  const nextDate = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  nextDate.setDate(nextDate.getDate() + 1);
  const ny = nextDate.getFullYear();
  const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
  const nd = String(nextDate.getDate()).padStart(2, '0');
  const endDateStr = `${ny}${nm}${nd}`;

  const eventTitle = `【PDCA評価期日】${title}`;
  const linkUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://pdca-mauve.vercel.app/');
  const eventDetails = `${description || '目標のPDCA評価締め切り日です。実績を確認して次のActionを決めましょう！'}\\n\\nPDCAアプリ: ${linkUrl}`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PDCA Check App//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:pdca-${Date.now()}-${startDateStr}@pdca-check.app`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART;VALUE=DATE:${startDateStr}`,
    `DTEND;VALUE=DATE:${endDateStr}`,
    `SUMMARY:${eventTitle}`,
    `DESCRIPTION:${eventDetails}`,
    `URL:${linkUrl}`,
    // 前日 15:00（日本時間前日朝9時相当）に通知
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:PDCA締め切りリマインド（前日）',
    'TRIGGER:-P1D',
    'END:VALARM',
    // 当日朝に通知
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:本日はPDCA評価の期日です！',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return icsLines.join('\r\n');
}

/**
 * iPhone / ブラウザで .ics ファイルを直接ダウンロード / カレンダーアプリ起動
 */
export function downloadIcsFile(options: CalendarEventOptions): void {
  if (typeof window === 'undefined') return;

  const content = generateIcsContent(options);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `pdca-reminder-${options.deadlineDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
