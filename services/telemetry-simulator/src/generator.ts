import { SITE_PROFILES } from "./profiles.js";
import type {
  SimulationDay,
  SiteProfile,
  TelemetryPayload,
  TelemetryStatus,
} from "./types.js";

/** Cadence and daylight constants shaping the simulated curve: readings every
 * 5 minutes, a simulated sunrise at 05:30 and sunset at 18:00, and the peak
 * solar curve amplitude (0.72 of full PV capacity). */
const SAMPLE_MINUTES = 5;
const SUNRISE_MINUTE = 5 * 60 + 30;
const SUNSET_MINUTE = 18 * 60;
const DAYLIGHT_MINUTES = SUNSET_MINUTE - SUNRISE_MINUTE;
const SOLAR_AMPLITUDE = 0.72;

/**
 * Returns the calendar date in Asia/Jakarta (UTC+7, no DST) `offsetDays` days from
 * today, as `YYYY-MM-DD`. The demo replays "yesterday" (day 1) and "today" (day 2)
 * so it stays meaningful on any real calendar date instead of a hardcoded fixture.
 * @param {number} offsetDays Positive offsets into the future, negative into the past.
 * @returns {string} The Jakarta-local date `offsetDays` from now.
 */
const jakartaDate = (offsetDays: number): string =>
  new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const DEMO_DATE: Record<SimulationDay, string> = {
  1: jakartaDate(-1),
  2: jakartaDate(0),
};

/** Rounds a number to a fixed number of decimal digits.
 * @param value The value to round.
 * @param digits Digits of precision after the point.
 * @returns The rounded value.
 */
const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Stable FNV-1a-derived value in [0, 1] for a key. Gives deterministic,
 * random-looking variation without `Math.random()`, so tests and demos replay
 * identically for the same inputs.
 * @param key Seed string (e.g. `"<site>:<day>:<minute>:power"`).
 * @returns A value in the half-open interval [0, 1).
 */
const deterministicUnit = (key: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0xffffffff;
};

/** Converts a local date + minute-of-day boundary into an ISO UTC timestamp in
 * the Asia/Jakarta (+07:00, no DST) timezone.
 * @param localDate The Jakarta-local calendar date as `YYYY-MM-DD`.
 * @param minuteOfDay A five-minute boundary of the day.
 * @returns The boundary as an ISO UTC string.
 */
const localTimestamp = (localDate: string, minuteOfDay: number): string => {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return new Date(
    `${localDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+07:00`,
  ).toISOString();
};

/** Whether the demo grid-overvoltage fault is active for a site/minute. Only the
 * Bekasi B profile faults, within a mid-day window that shifts slightly per day
 * so both days exercise the warning path at different boundaries.
 * @param site The site profile to evaluate.
 * @param day The simulated day (1 or 2).
 * @param minuteOfDay The five-minute boundary to check.
 * @returns `true` when the fault condition is active.
 */
const faultActive = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): boolean => {
  if (site.id !== "site-bekasi-b") return false;
  if (day === 1) return minuteOfDay >= 11 * 60 + 30 && minuteOfDay <= 13 * 60;
  return minuteOfDay >= 11 * 60 + 45 && minuteOfDay <= 12 * 60 + 30;
};

/** The fraction (0-0.72) of peak PV capacity available at a minute of day, via a
 * smooth `sin²` curve within the daylight window and 0 outside it.
 * @param minuteOfDay The minute of day to evaluate.
 * @returns A scaled daylight multiplier in [0, SOLAR_AMPLITUDE].
 */
const daylightShape = (minuteOfDay: number): number => {
  if (minuteOfDay < SUNRISE_MINUTE || minuteOfDay >= SUNSET_MINUTE) return 0;
  const progress = (minuteOfDay - SUNRISE_MINUTE) / DAYLIGHT_MINUTES;
  return SOLAR_AMPLITUDE * Math.sin(Math.PI * progress) ** 2;
};

const powerVariation = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): number =>
  0.97 + deterministicUnit(`${site.id}:${day}:${minuteOfDay}:power`) * 0.06;

/** Simulated AC output (watts) at a boundary: zero while the fault is active,
 * otherwise PV capacity scaled by the daylight curve and a per-slot jitter,
 * clamped to the inverter's AC rating and floor of 0.
 * @param site The site profile to produce power for.
 * @param day The simulated day.
 * @param minuteOfDay The five-minute boundary.
 * @returns The AC output in watts.
 */
const acPowerAt = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): number => {
  if (faultActive(site, day, minuteOfDay)) return 0;
  const potential =
    site.pvPeakPowerW *
    daylightShape(minuteOfDay) *
    powerVariation(site, day, minuteOfDay);
  return Math.max(0, Math.round(Math.min(site.inverterAcPowerW, potential)));
};

/** Cumulative energy (Wh) produced so far in the day by summing each five-minute
 * AC sample from midnight up to `minuteOfDay`.
 * @param site The site profile.
 * @param day The simulated day.
 * @param minuteOfDay The five-minute boundary up to which to accumulate.
 * @returns Cumulative energy in watt-hours.
 */
const energyTodayAt = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): number => {
  let wattHours = 0;
  for (let minute = 0; minute <= minuteOfDay; minute += SAMPLE_MINUTES) {
    wattHours += acPowerAt(site, day, minute) * (SAMPLE_MINUTES / 60);
  }
  return Math.round(wattHours);
};

const dayEnergy = (site: SiteProfile, day: SimulationDay): number =>
  energyTodayAt(site, day, 23 * 60 + 55);
const priorDayEnergy = (site: SiteProfile, day: SimulationDay): number =>
  day === 1 ? 0 : dayEnergy(site, 1);

const healthyVoltage = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): number =>
  225 + deterministicUnit(`${site.id}:${day}:${minuteOfDay}:voltage`) * 13;

const warningVoltage = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): number =>
  254 +
  deterministicUnit(`${site.id}:${day}:${minuteOfDay}:warning-voltage`) * 4;

const frequencyAt = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
): number =>
  49.95 + deterministicUnit(`${site.id}:${day}:${minuteOfDay}:frequency`) * 0.1;

/** Maps a minute + power to an operational status: `"warning"` during the fault
 * window, `"night"` outside daylight, `"starting"` for near-zero power in the
 * day, else `"running"`.
 * @param site The site profile.
 * @param day The simulated day.
 * @param minuteOfDay The five-minute boundary.
 * @param powerW The simulated AC power at that boundary.
 * @returns The derived {@link TelemetryStatus}.
 */
const statusAt = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
  powerW: number,
): TelemetryStatus => {
  if (faultActive(site, day, minuteOfDay)) return "warning";
  if (minuteOfDay < SUNRISE_MINUTE || minuteOfDay >= SUNSET_MINUTE)
    return "night";
  if (powerW <= site.inverterAcPowerW * 0.03) return "starting";
  return "running";
};

/**
 * Synthesizes a single telemetry reading for a site, day, and five-minute boundary.
 *
 * Returns a fully-populated {@link TelemetryPayload} built from the site's
 * mocked inverter profile and a deterministic random sequence, so the same
 * inputs always reproduce the same reading.
 *
 * @param {SiteProfile} site - The site profile the reading is produced for.
 * @param {SimulationDay} day - Which simulated day (1 or 2) the reading belongs to.
 * @param {number} minuteOfDay - The five-minute boundary of the day (0 through
 *   1435, multiples of 5) the reading covers.
 * @param {string} [localDate] - Local calendar date for the sample, defaulting
 *   to the demo date registered for the given {@link SimulationDay}.
 * @returns {TelemetryPayload} A synthetic telemetry payload for the boundary.
 * @throws {Error} If `minuteOfDay` is negative, above 1435, or not a multiple
 *   of 5.
 * @example
 * ```ts
 * const reading = generateTelemetry(SITE_PROFILES[0], 1, 720);
 * ```
 */
export const generateTelemetry = (
  site: SiteProfile,
  day: SimulationDay,
  minuteOfDay: number,
  localDate = DEMO_DATE[day],
): TelemetryPayload => {
  if (
    minuteOfDay < 0 ||
    minuteOfDay > 1435 ||
    minuteOfDay % SAMPLE_MINUTES !== 0
  ) {
    throw new Error(
      "minuteOfDay must be a five-minute boundary from 0 through 1435",
    );
  }

  const warning = faultActive(site, day, minuteOfDay);
  const powerW = acPowerAt(site, day, minuteOfDay);
  const todayWh = energyTodayAt(site, day, minuteOfDay);

  return {
    schemaVersion: "1.0",
    source: "telemetry-simulator",
    siteId: site.id,
    inverterId: site.inverterId,
    observedAt: localTimestamp(localDate, minuteOfDay),
    status: statusAt(site, day, minuteOfDay, powerW),
    errorCode: warning ? "GRID_OVERVOLTAGE" : null,
    metrics: {
      acPowerW: powerW,
      acVoltageV: round(
        warning
          ? warningVoltage(site, day, minuteOfDay)
          : healthyVoltage(site, day, minuteOfDay),
      ),
      frequencyHz: round(frequencyAt(site, day, minuteOfDay), 3),
      energyTodayWh: todayWh,
      energyTotalWh:
        site.totalEnergyBaseWh + priorDayEnergy(site, day) + todayWh,
    },
  };
};

/**
 * Generates a full day of telemetry readings for every configured site profile.
 *
 * Iterates over each five-minute boundary of the simulated day and delegates to
 * {@link generateTelemetry}, producing one reading per boundary per site.
 *
 * @param {SimulationDay} day - Which simulated day (1 or 2) to generate.
 * @returns {TelemetryPayload[]} A list of readings covering the whole day for
 *   all configured sites.
 */
export const generateDay = (day: SimulationDay): TelemetryPayload[] => {
  const readings: TelemetryPayload[] = [];
  for (let minute = 0; minute < 1440; minute += SAMPLE_MINUTES) {
    for (const site of SITE_PROFILES)
      readings.push(generateTelemetry(site, day, minute));
  }
  return readings;
};

/**
 * Computes the total simulated energy a site is expected to produce in a day.
 *
 * @param {SiteProfile} site - The site profile to compute expected energy for.
 * @param {SimulationDay} day - Which simulated day (1 or 2) to evaluate.
 * @returns {number} Total expected energy in watt-hours.
 */
export const expectedDayEnergyWh = (
  site: SiteProfile,
  day: SimulationDay,
): number => dayEnergy(site, day);
