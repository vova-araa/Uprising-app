// Client-side iCalendar (.ics) generation for bookings — no backend needed.
// Works with Google Calendar, Apple Calendar and Outlook.

const STUDIO_LOCATION = "Uprising Studio, Spaceshuttle 6e, Amersfoort";

interface BookingLike {
  booking_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM" or "HH:MM:SS"
  duration_hours: number;
}

// Escape per RFC 5545 (commas, semicolons, backslashes, newlines).
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

const pad = (n: number) => String(n).padStart(2, "0");

// Floating local time (studio = Europe/Amsterdam, users book local times).
function toICSLocal(date: string, time: string, addHours = 0): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(y, (mo || 1) - 1, d || 1, (h || 0) + addHours, mi || 0, 0);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

export function buildBookingICS(booking: BookingLike, title: string, description = ""): string {
  const start = toICSLocal(booking.booking_date, booking.start_time, 0);
  const end = toICSLocal(booking.booking_date, booking.start_time, booking.duration_hours || 1);
  const stamp = `${start.slice(0, 8)}T000000`;
  const uid = `${booking.booking_date}-${booking.start_time}-${Math.random().toString(36).slice(2, 8)}@uprisingstudio.nl`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Uprising Studio//Booking//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description)}` : "",
    `LOCATION:${esc(STUDIO_LOCATION)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

// Trigger a download of the .ics file (opens the calendar app on mobile).
export function downloadBookingICS(booking: BookingLike, title: string, description = ""): void {
  const ics = buildBookingICS(booking, title, description);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `uprising-${booking.booking_date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
