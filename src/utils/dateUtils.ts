/**
 * FOCUS OS Real Calendar and Time Engine
 * Handles real system dates, timezones, Monday-Sunday week boundaries,
 * ISO week numbers, and chronological event transitions.
 */

// Helper: pad number to 2 digits
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Convert Date object to YYYY-MM-DD in local time
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD safely into a local Date object (at midnight local time)
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

// Get current local date string: YYYY-MM-DD
export function getLocalToday(): string {
  return toISODateString(new Date());
}

// Get current local time string: HH:mm
export function getLocalNowTime(): string {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

// Get greeting based on current local hour
export function getGreeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ISO Week Number (1-53) calculation where week starts on Monday
export function getISOWeekNumber(d: Date): { year: number; week: number } {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNr + 3); // Thursday of this week
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  return { year, week: weekNumber };
}

export interface WeekDayInfo {
  date: string; // YYYY-MM-DD
  dayName: string; // "Monday"
  dayShort: string; // "Mon"
  dayNumber: number; // 7
  monthShort: string; // "Sep"
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface WeekBounds {
  weekId: string; // e.g. "2026-W37"
  weekNumber: number;
  startDate: string; // Monday: "2026-09-07"
  endDate: string; // Sunday: "2026-09-13"
  dateRange: string; // "September 7 – 13, 2026"
  shortDateRange: string; // "Sep 7 – 13"
  days: WeekDayInfo[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Calculate Monday-Sunday boundaries for any date (Date or string)
export function getWeekBounds(reference: Date | string = new Date()): WeekBounds {
  const refDate = typeof reference === 'string' ? parseISODate(reference) : new Date(reference);
  const todayStr = getLocalToday();

  // Find Monday (start of week)
  const currentDayOfWeek = refDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Distance from Monday (if Sunday=0, distance is -6; if Mon=1, distance is 0; etc.)
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;

  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + distanceToMonday);

  const days: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = toISODateString(dayDate);

    days.push({
      date: dateStr,
      dayName: DAY_NAMES[dayDate.getDay()],
      dayShort: DAY_NAMES_SHORT[dayDate.getDay()],
      dayNumber: dayDate.getDate(),
      monthShort: MONTH_NAMES_SHORT[dayDate.getMonth()],
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isFuture: dateStr > todayStr,
    });
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDateStr = days[0].date;
  const endDateStr = days[6].date;

  const { year, week } = getISOWeekNumber(monday);
  const weekId = `${year}-W${pad2(week)}`;

  // Format date range
  const startMonth = MONTH_NAMES[monday.getMonth()];
  const endMonth = MONTH_NAMES[sunday.getMonth()];
  const startYear = monday.getFullYear();
  const endYear = sunday.getFullYear();

  let dateRange = '';
  let shortDateRange = '';

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      dateRange = `${startMonth} ${monday.getDate()} – ${sunday.getDate()}, ${startYear}`;
      shortDateRange = `${MONTH_NAMES_SHORT[monday.getMonth()]} ${monday.getDate()}–${sunday.getDate()}`;
    } else {
      dateRange = `${startMonth} ${monday.getDate()} – ${endMonth} ${sunday.getDate()}, ${startYear}`;
      shortDateRange = `${MONTH_NAMES_SHORT[monday.getMonth()]} ${monday.getDate()} – ${MONTH_NAMES_SHORT[sunday.getMonth()]} ${sunday.getDate()}`;
    }
  } else {
    dateRange = `${startMonth} ${monday.getDate()}, ${startYear} – ${endMonth} ${sunday.getDate()}, ${endYear}`;
    shortDateRange = `${MONTH_NAMES_SHORT[monday.getMonth()]} '${String(startYear).slice(2)} – ${MONTH_NAMES_SHORT[sunday.getMonth()]} '${String(endYear).slice(2)}`;
  }

  return {
    weekId,
    weekNumber: week,
    startDate: startDateStr,
    endDate: endDateStr,
    dateRange,
    shortDateRange,
    days,
  };
}

// Shift a date by N weeks
export function shiftWeek(dateStr: string, deltaWeeks: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toISODateString(d);
}

// Format full date display: e.g. "Tuesday, September 8, 2026"
export function formatFullDate(dateStr: string): string {
  const d = parseISODate(dateStr);
  const dayName = DAY_NAMES[d.getDay()];
  const monthName = MONTH_NAMES[d.getMonth()];
  return `${dayName}, ${monthName} ${d.getDate()}, ${d.getFullYear()}`;
}

// Format relative date display: "Today", "Yesterday", "Tomorrow", or "Tuesday, Sep 8"
export function formatRelativeDate(dateStr: string): string {
  const todayStr = getLocalToday();
  if (dateStr === todayStr) return 'Today';

  const d = parseISODate(dateStr);
  const today = parseISODate(todayStr);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';

  const dayShort = DAY_NAMES_SHORT[d.getDay()];
  const monthShort = MONTH_NAMES_SHORT[d.getMonth()];
  return `${dayShort}, ${monthShort} ${d.getDate()}`;
}

// Check if an activity is happening right now
export function isActivityHappeningNow(
  dateStr: string,
  startTime?: string,
  durationMinutes: number = 45
): boolean {
  if (!startTime) return false;
  const todayStr = getLocalToday();
  if (dateStr !== todayStr) return false;

  const now = new Date();
  const [startHour, startMin] = startTime.split(':').map(Number);
  if (isNaN(startHour) || isNaN(startMin)) return false;

  const startTotalMinutes = startHour * 60 + startMin;
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const endTotalMinutes = startTotalMinutes + durationMinutes;

  return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes < endTotalMinutes;
}

// Check if an activity scheduled for today has passed its scheduled start time
export function isActivityOverdue(
  dateStr: string,
  startTime?: string
): boolean {
  const todayStr = getLocalToday();
  if (dateStr < todayStr) return true; // Past day
  if (dateStr > todayStr) return false; // Future day
  if (!startTime) return false;

  const now = new Date();
  const [startHour, startMin] = startTime.split(':').map(Number);
  if (isNaN(startHour) || isNaN(startMin)) return false;

  const startTotalMinutes = startHour * 60 + startMin;
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  return currentTotalMinutes > startTotalMinutes + 30; // 30 min buffer before considering overdue
}
