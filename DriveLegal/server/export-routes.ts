import type { Express, Request, Response } from "express";
import { storagePut } from "./storage";
import XlsxPopulate from "xlsx-populate";
import PDFDocument from "pdfkit";

/**
 * DRIVE LEGAL EXPORT ROUTES
 *
 * Supports:
 * - CSV export
 * - PDF export
 * - Password-protected Excel export
 *
 * The mobile app must send the selected log records in req.body.logs.
 */

type ExportLog = {
  date?: string;

  startTime?: string;
  start_time?: string;

  endTime?: string;
  end_time?: string;

  totalDrivingSeconds?: number;
  total_driving_seconds?: number;

  totalWorkSeconds?: number;
  total_work_seconds?: number;

  distanceKm?: number;
  distance_km?: number;

  breaks?: Array<{
    durationSeconds?: number;
    duration_seconds?: number;
  }>;
};

type NormalizedLog = {
  date: string;
  start: string;
  end: string;
  drivingSeconds: number;
  workSeconds: number;
  breakSeconds: number;
  distanceKm: number;
};

function parseNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}

function formatDate(value: unknown): string {
  if (!isValidDate(value)) {
    return typeof value === "string" ? value : "";
  }

  return new Date(value).toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
  });
}

function formatTime(value: unknown): string {
  if (!isValidDate(value)) {
    return typeof value === "string" ? value : "";
  }

  return new Date(value).toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Pacific/Auckland",
  });
}

function formatHoursMinutes(seconds: unknown): string {
  const totalSeconds = Math.max(0, parseNumber(seconds));
  const totalMinutes = Math.floor(totalSeconds / 60);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function normalizeLog(log: ExportLog): NormalizedLog {
  const startRaw = log.startTime ?? log.start_time ?? "";
  const endRaw = log.endTime ?? log.end_time ?? "";

  const breakSeconds = Array.isArray(log.breaks)
    ? log.breaks.reduce((total, breakEntry) => {
        return (
          total +
          parseNumber(
            breakEntry?.durationSeconds ??
              breakEntry?.duration_seconds ??
              0
          )
        );
      }, 0)
    : 0;

  const explicitDate =
    typeof log.date === "string" && log.date.trim() !== ""
      ? log.date
      : "";

  return {
    date: explicitDate || formatDate(startRaw),
    start: formatTime(startRaw),
    end: formatTime(endRaw),
    drivingSeconds: parseNumber(
      log.totalDrivingSeconds ??
        log.total_driving_seconds ??
        0
    ),
    workSeconds: parseNumber(
      log.totalWorkSeconds ??
        log.total_work_seconds ??
        0
    ),
    breakSeconds,
    distanceKm: parseNumber(
      log.distanceKm ??
        log.distance_km ??
        0
    ),
  };
}

function getLogsFromRequest(req: Request): NormalizedLog[] {
  const requestLogs = req.body?.logs;

  if (!Array.isArray(requestLogs)) {
    return [];
  }

  return requestLogs.map((log: ExportLog) => normalizeLog(log));
}

function escapeCsv(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function safeText(value: unknown): string {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return "—";
  }

  return String(value);
}

function validateExportRequest(
  req: Request,
  res: Response
): NormalizedLog[] | null {
  const driverId = req.body?.driverId;

  if (!driverId) {
    res.status(400).json({
      error: "driverId required",
    });

    return null;
  }

  const logs = getLogsFromRequest(req);

  if (logs.length === 0) {
    res.status(400).json({
      error: "No log records were supplied for export.",
    });

    return null;
  }

  return logs;
}

export function exportRouter(app: Express): void {
  /**
   * CSV EXPORT
   */
  app.post(
    "/api/export/csv",
    async (req: Request, res: Response) => {
      try {
        const logs = validateExportRequest(req, res);

        if (!logs) {
          return;
        }

        const header = [
          "Date",
          "Start",
          "End",
          "Driving",
          "Work",
          "Breaks",
          "Distance (km)",
        ]
          .map(escapeCsv)
          .join(",");

        const rows = logs.map((log) => {
          return [
            log.date,
            log.start,
            log.end,
            formatHoursMinutes(log.drivingSeconds),
            formatHoursMinutes(log.workSeconds),
            formatHoursMinutes(log.breakSeconds),
            log.distanceKm.toFixed(1),
          ]
            .map(escapeCsv)
            .join(",");
        });

        const csv = `\uFEFF${[header, ...rows].join("\r\n")}`;

        const fileName = `exports/drive-legal-logbook-${Date.now()}.csv`;

        const { url } = await storagePut(
          fileName,
          Buffer.from(csv, "utf-8"),
          "text/csv; charset=utf-8"
        );

        return res.json({
          success: true,
          fileName,
          url,
          downloadUrl: url,
        });
      } catch (error: unknown) {
        console.error("[CSV EXPORT ERROR]", error);

        const message =
          error instanceof Error
            ? error.message
            : "CSV export failed.";

        return res.status(500).json({
          error: message,
        });
      }
    }
  );

  /**
   * PDF EXPORT
   */
  app.post(
    "/api/export/pdf",
    async (req: Request, res: Response) => {
      try {
        const logs = validateExportRequest(req, res);

        if (!logs) {
          return;
        }

        const {
          driverName,
          licenceNumber,
          vehicleRegistration,
          vehicleRego,
          vehicleType,
          driverType,
        } = req.body ?? {};

        const document = new PDFDocument({
          size: "A4",
          layout: "landscape",
          margins: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40,
          },
          info: {
            Title: "Drive Legal Logbook Report",
            Author: driverName || "Drive Legal",
            Subject: "Driver work-time and logbook report",
            Creator: "Drive Legal",
          },
        });

        const chunks: Buffer[] = [];

        document.on(
          "data",
          (chunk: Buffer | Uint8Array) => {
            chunks.push(Buffer.from(chunk));
          }
        );

        const pdfComplete = new Promise<Buffer>(
          (resolve, reject) => {
            document.on("end", () => {
              resolve(Buffer.concat(chunks));
            });

            document.on("error", reject);
          }
        );

        const pageWidth =
          document.page.width -
          document.page.margins.left -
          document.page.margins.right;

        const columns = [
          { label: "Date", width: 90 },
          { label: "Start", width: 75 },
          { label: "End", width: 75 },
          { label: "Driving", width: 90 },
          { label: "Work", width: 90 },
          { label: "Breaks", width: 90 },
          { label: "Distance", width: 90 },
        ];

        const rowHeight = 24;
        const tableLeft = document.page.margins.left;

        const drawHeader = (): void => {
          document
            .fillColor("#003366")
            .font("Helvetica-Bold")
            .fontSize(22)
            .text("Drive Legal Logbook Report", {
              align: "left",
            });

          document.moveDown(0.3);

          document
            .fillColor("#4A5568")
            .font("Helvetica")
            .fontSize(10);

          document.text(
            `Driver: ${safeText(driverName)}`
          );

          document.text(
            `Licence: ${safeText(licenceNumber)}`
          );

          document.text(
            `Vehicle registration: ${safeText(
              vehicleRegistration ?? vehicleRego
            )}`
          );

          document.text(
            `Vehicle type: ${safeText(vehicleType)}`
          );

          document.text(
            `Driver type: ${safeText(driverType)}`
          );

          document.text(
            `Generated: ${new Date().toLocaleString(
              "en-NZ",
              {
                timeZone: "Pacific/Auckland",
              }
            )}`
          );

          document.moveDown(0.8);
        };

        const drawTableHeader = (): void => {
          const y = document.y;

          document
            .rect(tableLeft, y, pageWidth, rowHeight)
            .fill("#003366");

          let x = tableLeft;

          document
            .fillColor("#FFFFFF")
            .font("Helvetica-Bold")
            .fontSize(9);

          columns.forEach((column) => {
            document.text(
              column.label,
              x + 5,
              y + 7,
              {
                width: column.width - 10,
                align: "left",
              }
            );

            x += column.width;
          });

          document.y = y + rowHeight;
        };

        const drawRow = (
          values: string[],
          rowIndex: number
        ): void => {
          if (
            document.y + rowHeight >
            document.page.height -
              document.page.margins.bottom
          ) {
            document.addPage();
            drawHeader();
            drawTableHeader();
          }

          const y = document.y;

          if (rowIndex % 2 === 1) {
            document
              .rect(tableLeft, y, pageWidth, rowHeight)
              .fill("#F3F6FA");
          }

          document
            .rect(tableLeft, y, pageWidth, rowHeight)
            .lineWidth(0.5)
            .strokeColor("#CBD5E1")
            .stroke();

          let x = tableLeft;

          document
            .fillColor("#1F2937")
            .font("Helvetica")
            .fontSize(8.5);

          values.forEach((value, columnIndex) => {
            const width =
              columns[columnIndex]?.width ?? 90;

            document.text(
              value,
              x + 5,
              y + 7,
              {
                width: width - 10,
                height: rowHeight - 8,
                ellipsis: true,
              }
            );

            if (columnIndex < values.length - 1) {
              document
                .moveTo(x + width, y)
                .lineTo(
                  x + width,
                  y + rowHeight
                )
                .strokeColor("#CBD5E1")
                .lineWidth(0.5)
                .stroke();
            }

            x += width;
          });

          document.y = y + rowHeight;
        };

        drawHeader();
        drawTableHeader();

        logs.forEach((log, index) => {
          drawRow(
            [
              safeText(log.date),
              safeText(log.start),
              safeText(log.end),
              formatHoursMinutes(
                log.drivingSeconds
              ),
              formatHoursMinutes(
                log.workSeconds
              ),
              formatHoursMinutes(
                log.breakSeconds
              ),
              `${log.distanceKm.toFixed(1)} km`,
            ],
            index
          );
        });

        document.moveDown(1);

        document
          .fillColor("#64748B")
          .font("Helvetica")
          .fontSize(8)
          .text(
            "This report was generated from Drive Legal electronic logbook records.",
            {
              align: "left",
            }
          );

        document.end();

        const pdfBuffer = await pdfComplete;

        const fileName = `exports/drive-legal-report-${Date.now()}.pdf`;

        const { url } = await storagePut(
          fileName,
          pdfBuffer,
          "application/pdf"
        );

        return res.json({
          success: true,
          fileName,
          url,
          downloadUrl: url,
        });
      } catch (error: unknown) {
        console.error("[PDF EXPORT ERROR]", error);

        const message =
          error instanceof Error
            ? error.message
            : "PDF export failed.";

        return res.status(500).json({
          error: message,
        });
      }
    }
  );

  /**
   * EXCEL EXPORT
   */
  app.post(
    "/api/export/excel",
    async (req: Request, res: Response) => {
      try {
        const logs = validateExportRequest(req, res);

        if (!logs) {
          return;
        }

        const {
          driverName,
          licenceNumber,
          vehicleRegistration,
          vehicleRego,
          vehicleType,
          driverType,
          password,
        } = req.body ?? {};

        const workbook =
          await XlsxPopulate.fromBlankAsync();

        const sheet = workbook
          .sheet(0)
          .name("Logbook");

        sheet
          .range("A1:G1")
          .merged(true);

        sheet
          .cell("A1")
          .value("DRIVE LEGAL LOGBOOK REPORT")
          .style({
            bold: true,
            fill: "003366",
            fontColor: "FFFFFF",
            fontSize: 16,
            horizontalAlignment: "center",
            verticalAlignment: "center",
          });

        sheet.row(1).height(28);

        sheet.cell("A2").value("Driver");
        sheet
          .range("B2:C2")
          .merged(true)
          .value(driverName || "");

        sheet.cell("D2").value("Licence");
        sheet
          .range("E2:G2")
          .merged(true)
          .value(licenceNumber || "");

        sheet
          .cell("A3")
          .value("Vehicle registration");

        sheet
          .range("B3:C3")
          .merged(true)
          .value(
            vehicleRegistration ??
              vehicleRego ??
              ""
          );

        sheet.cell("D3").value("Vehicle type");
        sheet
          .range("E3:G3")
          .merged(true)
          .value(vehicleType || "");

        sheet.cell("A4").value("Driver type");
        sheet
          .range("B4:C4")
          .merged(true)
          .value(driverType || "");

        sheet.cell("D4").value("Generated");
        sheet
          .range("E4:G4")
          .merged(true)
          .value(
            new Date().toLocaleString("en-NZ", {
              timeZone: "Pacific/Auckland",
            })
          );

        sheet
          .range("A2:G4")
          .style({
            border: true,
            verticalAlignment: "center",
          });

        sheet
          .range("A2:A4")
          .style({
            bold: true,
            fill: "EAF0F8",
          });

        sheet
          .range("D2:D4")
          .style({
            bold: true,
            fill: "EAF0F8",
          });

        const headers = [
          "Date",
          "Start",
          "End",
          "Driving",
          "Work",
          "Breaks",
          "Distance (km)",
        ];

        headers.forEach((header, index) => {
          sheet
            .cell(6, index + 1)
            .value(header)
            .style({
              bold: true,
              fill: "003366",
              fontColor: "FFFFFF",
              horizontalAlignment: "center",
              verticalAlignment: "center",
              border: true,
            });
        });

        logs.forEach((log, index) => {
          const row = index + 7;

          sheet.cell(row, 1).value(log.date);
          sheet.cell(row, 2).value(log.start);
          sheet.cell(row, 3).value(log.end);

          sheet
            .cell(row, 4)
            .value(
              formatHoursMinutes(
                log.drivingSeconds
              )
            );

          sheet
            .cell(row, 5)
            .value(
              formatHoursMinutes(
                log.workSeconds
              )
            );

          sheet
            .cell(row, 6)
            .value(
              formatHoursMinutes(
                log.breakSeconds
              )
            );

          sheet
            .cell(row, 7)
            .value(log.distanceKm);

          sheet
            .range(row, 1, row, 7)
            .style({
              border: true,
              verticalAlignment: "center",
            });

          if (index % 2 === 1) {
            sheet
              .range(row, 1, row, 7)
              .style({
                fill: "F3F6FA",
              });
          }
        });

        sheet.column("A").width(14);
        sheet.column("B").width(12);
        sheet.column("C").width(12);
        sheet.column("D").width(14);
        sheet.column("E").width(14);
        sheet.column("F").width(14);
        sheet.column("G").width(15);

        sheet.freezePanes(6, 0);

        const cleanPassword =
          typeof password === "string"
            ? password.trim()
            : "";

        const buffer =
          await workbook.outputAsync(
            cleanPassword
              ? {
                  password: cleanPassword,
                }
              : undefined
          );

        const fileName = `exports/drive-legal-logbook-${Date.now()}.xlsx`;

        const { url } = await storagePut(
          fileName,
          Buffer.from(buffer),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        return res.json({
          success: true,
          fileName,
          protected: Boolean(cleanPassword),
          url,
          downloadUrl: url,
        });
      } catch (error: unknown) {
        console.error(
          "[EXCEL EXPORT ERROR]",
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate Excel export.";

        return res.status(500).json({
          error: message,
        });
      }
    }
  );
}
