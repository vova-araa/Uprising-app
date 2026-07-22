import { describe, it, expect } from "vitest";
import { buildBookingICS } from "@/lib/calendar";

describe("buildBookingICS", () => {
  const booking = { booking_date: "2026-08-15", start_time: "14:00", duration_hours: 3 };

  it("produces a valid VCALENDAR/VEVENT envelope", () => {
    const ics = buildBookingICS(booking, "Studio 1 sessie");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("SUMMARY:Studio 1 sessie");
  });

  it("sets DTEND = DTSTART + duration hours", () => {
    const ics = buildBookingICS(booking, "x");
    expect(ics).toMatch(/DTSTART:20260815T140000/);
    expect(ics).toMatch(/DTEND:20260815T170000/);
  });

  it("rolls the end time over midnight correctly", () => {
    const ics = buildBookingICS({ booking_date: "2026-08-15", start_time: "23:00", duration_hours: 2 }, "late");
    expect(ics).toMatch(/DTSTART:20260815T230000/);
    expect(ics).toMatch(/DTEND:20260816T010000/);
  });

  it("escapes commas/semicolons in the summary and location", () => {
    const ics = buildBookingICS(booking, "Mix, master; edit");
    expect(ics).toContain("SUMMARY:Mix\\, master\\; edit");
    expect(ics).toContain("LOCATION:Uprising Studio\\, Spaceshuttle 6e\\, Amersfoort");
  });

  it("includes a 1-hour reminder alarm", () => {
    const ics = buildBookingICS(booking, "x");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT1H");
  });
});
