const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Calendar date (YYYY-MM-DD). Arithmetic is calendar-day based (UTC date parts)
 * so wall-clock timezone does not shift the day.
 */
export class CalendarDate {
  private constructor(readonly value: string) {}

  static create(input: string): CalendarDate {
    const trimmed = input.trim();
    const match = ISO_DATE.exec(trimmed);
    if (match === null) {
      throw new Error('Calendar date must be YYYY-MM-DD');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
      utc.getUTCFullYear() !== year ||
      utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day
    ) {
      throw new Error('Calendar date is not a valid calendar day');
    }

    return new CalendarDate(trimmed);
  }

  addDays(days: number): CalendarDate {
    if (!Number.isInteger(days)) {
      throw new Error('Day offset must be an integer');
    }

    const [yearRaw, monthRaw, dayRaw] = this.value.split('-');
    const utc = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw) + days));
    const yyyy = String(utc.getUTCFullYear()).padStart(4, '0');
    const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(utc.getUTCDate()).padStart(2, '0');
    return CalendarDate.create(`${yyyy}-${mm}-${dd}`);
  }
}
