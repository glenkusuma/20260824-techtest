import type { TelemetryRecord } from "../types/models.js";

/** CSV header columns, fixed in the archival order. */
const columns = [
  "id",
  "site_id",
  "inverter_id",
  "observed_at",
  "received_at",
  "ac_power_w",
  "ac_voltage_v",
  "frequency_hz",
  "energy_today_wh",
  "energy_total_wh",
  "status",
  "error_code",
] as const;

/** Emits a single CSV field, quoting the value when it contains a comma, double
 * quote, carriage return, or newline; embedded quotes are doubled. Nulls become empty.
 * @param value The field value to escape.
 * @returns The RFC-style quoted (or bare) text.
 */
const escapeCsv = (value: string | number | null): string => {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/**
 * Serializes telemetry records into a CSV string with a header row.
 *
 * Output uses a fixed column order and RFC-style quoting: fields containing a
 * comma, double quote, carriage-return, or newline are wrapped in double quotes
 * with embedded quotes doubled. Null values are emitted as empty fields.
 */
export class CsvSerializer {
  /**
   * Builds the CSV text for the given records, escaping fields as needed.
   *
   * @param records - Telemetry records to serialize; an empty array yields only
   *   the header row.
   * @returns The complete CSV text including a header row and one line per record.
   * @example
   * ```ts
   * const csv = new CsvSerializer().serialize(records);
   * ```
   */
  public serialize(records: TelemetryRecord[]): string {
    const rows = records.map((record) =>
      [
        record.id,
        record.siteId,
        record.inverterId,
        record.observedAt,
        record.receivedAt,
        record.acPowerW,
        record.acVoltageV,
        record.frequencyHz,
        record.energyTodayWh,
        record.energyTotalWh,
        record.status,
        record.errorCode,
      ]
        .map(escapeCsv)
        .join(","),
    );
    return `${columns.join(",")}\n${rows.length ? `${rows.join("\n")}\n` : ""}`;
  }
}
