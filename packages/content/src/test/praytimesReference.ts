/**
 * An independent implementation of the published PrayTimes.org algorithm (Hamid Zarrabi-Zadeh,
 * https://praytimes.org/calculation), written from its documented formulas. The Aladhan service
 * V1 called uses the same method for the Karachi calculation, so this is what the on-device
 * `adhan` results are checked against, without needing the network.
 *
 * Karachi: Fajr 18 degrees, Isha 18 degrees, sunrise and sunset at 0.833 degrees. Hanafi Asr:
 * the shadow is twice the object's length plus the noon shadow.
 */
const dtr = (d: number) => (d * Math.PI) / 180;
const rtd = (r: number) => (r * 180) / Math.PI;
const sin = (d: number) => Math.sin(dtr(d));
const cos = (d: number) => Math.cos(dtr(d));
const tan = (d: number) => Math.tan(dtr(d));
const arcsin = (x: number) => rtd(Math.asin(x));
const arccos = (x: number) => rtd(Math.acos(x));
const arctan2 = (y: number, x: number) => rtd(Math.atan2(y, x));
const arccot = (x: number) => rtd(Math.atan(1 / x));
const fix = (a: number, mode: number) => {
  const r = a - mode * Math.floor(a / mode);
  return r < 0 ? r + mode : r;
};

function julian(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(arctan2(cos(e) * sin(L), cos(L)) / 15, 24);
  return { declination: arcsin(sin(e) * sin(L)), equation: q / 15 - RA };
}

export interface ReferenceTimes {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

/** Minutes after local midnight, rounded to the nearest minute as PrayTimes prints them. */
export function referenceKarachiHanafi(
  latitude: number,
  longitude: number,
  date: { year: number; month: number; day: number },
  timeZoneHours: number,
): ReferenceTimes {
  const jd = julian(date.year, date.month, date.day) - longitude / (15 * 24);
  const midDay = (t: number) => fix(12 - sunPosition(jd + t).equation, 24);
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const decl = sunPosition(jd + t).declination;
    const noon = midDay(t);
    const h =
      (1 / 15) * arccos((-sin(angle) - sin(decl) * sin(latitude)) / (cos(decl) * cos(latitude)));
    return noon + (ccw ? -h : h);
  };
  const asrTime = (factor: number, t: number) => {
    const decl = sunPosition(jd + t).declination;
    return angleTime(-arccot(factor + tan(Math.abs(latitude - decl))), t, false);
  };

  const raw = {
    fajr: angleTime(18, 5 / 24, true),
    sunrise: angleTime(0.833, 6 / 24, true),
    dhuhr: midDay(12 / 24),
    asr: asrTime(2, 13 / 24),
    maghrib: angleTime(0.833, 18 / 24, false),
    isha: angleTime(18, 18 / 24, false),
  };
  const shift = timeZoneHours - longitude / 15;
  const toMinutes = (hours: number) => Math.round(fix(hours + shift, 24) * 60) % 1440;
  return {
    fajr: toMinutes(raw.fajr),
    sunrise: toMinutes(raw.sunrise),
    dhuhr: toMinutes(raw.dhuhr),
    asr: toMinutes(raw.asr),
    maghrib: toMinutes(raw.maghrib),
    isha: toMinutes(raw.isha),
  };
}
