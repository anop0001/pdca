/**
 * スマホ標準カレンダー（Googleカレンダー / iOSカレンダー / iCal）と
 * 連携して完全無料（0円）でリマインダー・アラーム通知を登録するためのユーティリティ
 */

export type TimeSlot = 'morning' | 'noon' | 'evening' | 'night' | 'all_day' | 'custom';

export type PlanFrequency = 'daily' | 'weekday' | 'weekdays' | 'weekly' | 'single';

export interface FrequencyConfig {
  id: string;
  label: string;
  badge: string;
  tabLabel: string;
  rruleFreq: string;
  isRecurring: boolean;
}

export const FREQUENCY_CONFIG: Record<string, FrequencyConfig> = {
  daily: {
    id: 'daily',
    label: '毎日',
    badge: '毎日リピート',
    tabLabel: '毎日の行動予定',
    rruleFreq: 'FREQ=DAILY',
    isRecurring: true,
  },
  weekday: {
    id: 'weekday',
    label: '平日のみ',
    badge: '平日（月〜金）リピート',
    tabLabel: '平日のみの行動予定',
    rruleFreq: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    isRecurring: true,
  },
  weekdays: {
    id: 'weekdays',
    label: '平日のみ',
    badge: '平日（月〜金）リピート',
    tabLabel: '平日のみの行動予定',
    rruleFreq: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    isRecurring: true,
  },
  weekly: {
    id: 'weekly',
    label: '毎週',
    badge: '毎週リピート',
    tabLabel: '毎週の行動予定',
    rruleFreq: 'FREQ=WEEKLY',
    isRecurring: true,
  },
  single: {
    id: 'single',
    label: '期日までに1度',
    badge: '1度のみ実行',
    tabLabel: '期日までの実行予定',
    rruleFreq: '',
    isRecurring: false,
  },
};

export interface CalendarEventOptions {
  title: string;
  description?: string;
  deadlineDate?: string; // 'YYYY-MM-DD'
  targetValue?: number | string;
  unit?: string;
  frequency?: string; // 'daily' | 'weekday' | 'weekdays' | 'weekly' | 'single'
  appUrl?: string;
  mode?: 'action' | 'deadline'; // default 'action' (行動ベース)
  timeSlot?: TimeSlot;
  customStartTime?: string; // 'HH:mm'
  customDurationMinutes?: number; // e.g. 30
  isRevision?: boolean;
}

export const TIME_SLOT_CONFIG: Record<
  Exclude<TimeSlot, 'custom' | 'all_day'>,
  { label: string; icon: string; start: string; end: string; duration: number }
> = {
  morning: { label: '朝', icon: '☀️', start: '09:00', end: '09:30', duration: 30 },
  noon: { label: '昼', icon: '🕛', start: '12:30', end: '13:00', duration: 30 },
  evening: { label: '夕方', icon: '🌆', start: '18:00', end: '18:30', duration: 30 },
  night: { label: '夜', icon: '🌙', start: '21:00', end: '21:30', duration: 30 },
};

/**
 * Googleカレンダー登録用のWeb URLを生成
 */
export function getGoogleCalendarUrl(options: CalendarEventOptions): string {
  const {
    title,
    description,
    deadlineDate,
    targetValue,
    unit = '回',
    frequency = 'daily',
    appUrl,
    mode = 'action',
    timeSlot = 'morning',
    customStartTime = '09:00',
    customDurationMinutes = 30,
  } = options;

  const originUrl = appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://pdca-mauve.vercel.app/');

  const freqKey = frequency || 'daily';
  const freqCfg = FREQUENCY_CONFIG[freqKey] || FREQUENCY_CONFIG.daily;

  // 今日のJST日付（YYYY-MM-DD）
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = jstNow.toISOString().slice(0, 10);

  // タイトル
  const eventTitle = mode === 'deadline'
    ? `【PDCA評価期日】${title}`
    : `【PDCA実行】${title}${targetValue ? ` (${freqCfg.label} ${targetValue}${unit})` : ''}`;

  // 詳細説明
  const eventDetails = mode === 'deadline'
    ? [
        description || '目標のPDCA評価締め切り日です。実績を確認して次のActionを決めましょう！',
        '',
        '▼PDCAアプリを開いて確認・改訂:',
        originUrl,
      ].join('\n')
    : [
        `🎯 本日のPDCA行動目標: ${title}`,
        targetValue ? `目標値: ${freqCfg.label} ${targetValue}${unit}` : '',
        deadlineDate ? `評価期日: ${deadlineDate}` : '',
        '',
        '行動を実行したら、PDCAアプリを開いて実績を入力しましょう！',
        '▼PDCA記録を開く👇',
        originUrl,
      ].filter(Boolean).join('\n');

  let datesParam = '';
  let recurParam: string | null = null;

  if (mode === 'deadline') {
    // 締め切り日単発（終日予定）
    const targetDateStr = deadlineDate || todayStr;
    const [y, m, d] = targetDateStr.split('-');
    const startDateStr = `${y}${m}${d}`;
    const nextDate = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nd = String(nextDate.getDate()).padStart(2, '0');
    datesParam = `${startDateStr}/${ny}${nm}${nd}`;
  } else {
    // 行動ベース（指定時間帯 or 終日 ＋ 実行頻度・締め切り日連動）
    const targetStartDateStr = (freqCfg.id === 'single' && deadlineDate) ? deadlineDate : todayStr;

    if (timeSlot === 'all_day') {
      const ymd = targetStartDateStr.replace(/-/g, '');
      const nextDate = new Date(`${targetStartDateStr}T00:00:00+09:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextYmd = nextDate.toISOString().slice(0, 10).replace(/-/g, '');
      datesParam = `${ymd}/${nextYmd}`;
    } else {
      let startTimeStr = '09:00';
      let durationMin = 30;

      if (timeSlot === 'custom') {
        startTimeStr = customStartTime || '09:00';
        durationMin = customDurationMinutes || 30;
      } else if (TIME_SLOT_CONFIG[timeSlot]) {
        startTimeStr = TIME_SLOT_CONFIG[timeSlot].start;
        durationMin = TIME_SLOT_CONFIG[timeSlot].duration;
      }

      const startJst = new Date(`${targetStartDateStr}T${startTimeStr}:00+09:00`);
      const endJst = new Date(startJst.getTime() + durationMin * 60000);

      const startUtc = startJst.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const endUtc = endJst.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      datesParam = `${startUtc}/${endUtc}`;
    }

    // 繰り返しルール (RRULE) - 実行頻度と完全連動
    if (freqCfg.isRecurring && freqCfg.rruleFreq) {
      if (deadlineDate) {
        const untilDate = new Date(`${deadlineDate}T23:59:59+09:00`);
        const untilUtc = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        recurParam = `RRULE:${freqCfg.rruleFreq};UNTIL=${untilUtc}`;
      } else {
        recurParam = `RRULE:${freqCfg.rruleFreq}`;
      }
    } else {
      // 期日までに1度（繰り返しなし）
      recurParam = null;
    }
  }

  const queryParams: Record<string, string> = {
    action: 'TEMPLATE',
    text: eventTitle,
    details: eventDetails,
    dates: datesParam,
    ctz: 'Asia/Tokyo',
  };

  if (recurParam) {
    queryParams.recur = recurParam;
  }

  const params = new URLSearchParams(queryParams);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * iPhone / Mac / Windows / Android用 .ics カレンダーファイルを生成
 * - 締め切り前日の朝9:00および当日朝9:00にアラーム通知（VALARM）を自動設定
 */
export function generateIcsContent(options: CalendarEventOptions): string {
  const { title, description, deadlineDate, appUrl } = options;
  const targetDate = deadlineDate || new Date().toISOString().slice(0, 10);
  const parts = targetDate.split('-');
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
  a.download = `pdca-reminder-${options.deadlineDate || 'daily'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
