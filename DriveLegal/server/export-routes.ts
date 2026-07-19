import { Express, Request, Response } from "express";
import { storagePut } from "./storage";
import { query } from "./db";
import XlsxPopulate from "xlsx-populate";
import PDFDocument from "pdfkit";

/**
 * EXPORT ROUTES HUB
 * Connects PDF / CSV / Excel exports into one system
 */

export function exportRouter(app: Express) {
  /* ─────────────────────────────────────────────
     CSV EXPORT
  ───────────────────────────────────────────── */
  app.post("/api/export/csv", async (req: Request, res: Response) => {
    try {
      const { driverId, logs: requestLogs } = req.body;

if (!driverId) {
  return res.status(400).json({
    error: "driverId required",
  });
}

if (!Array.isArray(requestLogs) || requestLogs.length === 0) {
  return res.status(400).json({
    error: "No log records were supplied for export.",
  });
}

const logs = requestLogs;

      const header = "Date,Start,End,Driving,Work,Distance";

      const rows = logs.map((log) => {
        const escape = (value: unknown) =>
          `"${String(value ?? "").replace(/"/g, '""')}"`;

        return [
          log.date,
          log.start_time,
          log.end_time,
          ((log.total_driving_seconds || 0) / 3600).toFixed(2),
          ((log.total_work_seconds || 0) / 3600).toFixed(2),
          log.distance_km || 0,
        ]
          .map(escape)
          .join(",");
      });

      const csv = [header, ...rows].join("\n");

      const { url } = await storagePut(
        `exports/logs-${Date.now()}.csv`,
        Buffer.from(csv, "utf-8"),
        "text/csv"
      );

      return res.json({ url });
    } catch (error: any) {
      console.error("[CSV EXPORT ERROR]", error);

      return res.status(500).json({
        error: error?.message || "CSV export failed.",
      });
    }
  });

  /* ─────────────────────────────────────────────
     REAL PDF EXPORT
  ───────────────────────────────────────────── */
  app.post("/api/export/pdf", async (req: Request, res: Response) => {
    try {
      const {
        driverId,
        driverName,
        licenceNumber,
        vehicleRegistration,
        vehicleType,
        driverType,
      } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      const logs = await query<any[]>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

      if (!Array.isArray(logs) || logs.length === 0) {
        return res.status(404).json({
          error: "No shift records were found for this driver.",
        });
      }

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

      document.on("data", (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.from(chunk));
      });

      const pdfComplete = new Promise<Buffer>((resolve, reject) => {
        document.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        document.on("error", reject);
      });

      const pageWidth =
        document.page.width -
        document.page.margins.left -
        document.page.margins.right;

      const columns = [
        { label: "Date", width: 90 },
        { label: "Start", width: 90 },
        { label: "End", width: 90 },
        { label: "Driving", width: 90 },
        { label: "Work", width: 90 },
        { label: "Distance", width: 90 },
      ];

      const rowHeight = 24;
      const tableLeft = document.page.margins.left;

      const formatHours = (seconds: unknown): string => {
        const numericSeconds = Number(seconds) || 0;
        return `${(numericSeconds / 3600).toFixed(2)} hrs`;
      };

      const formatValue = (value: unknown): string => {
        if (value === null || value === undefined || value === "") {
          return "—";
        }

        return String(value);
      };

      const drawHeader = () => {
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

        document.text(`Driver: ${formatValue(driverName)}`);
        document.text(`Licence: ${formatValue(licenceNumber)}`);
        document.text(
          `Vehicle registration: ${formatValue(vehicleRegistration)}`
        );
        document.text(`Vehicle type: ${formatValue(vehicleType)}`);
        document.text(`Driver type: ${formatValue(driverType)}`);
        document.text(
          `Generated: ${new Date().toLocaleString("en-NZ", {
            timeZone: "Pacific/Auckland",
          })}`
        );

        document.moveDown(0.8);
      };

      const drawTableHeader = () => {
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
          document.text(column.label, x + 5, y + 7, {
            width: column.width - 10,
            align: "left",
          });

          x += column.width;
        });

        document.y = y + rowHeight;
      };

      const drawRow = (values: string[], rowIndex: number) => {
        const y = document.y;

        if (y + rowHeight > document.page.height - 50) {
          document.addPage();
          drawHeader();
          drawTableHeader();
        }

        const actualY = document.y;

        if (rowIndex % 2 === 1) {
          document
            .rect(tableLeft, actualY, pageWidth, rowHeight)
            .fill("#F3F6FA");
        }

        document
          .rect(tableLeft, actualY, pageWidth, rowHeight)
          .lineWidth(0.5)
          .strokeColor("#CBD5E1")
          .stroke();

        let x = tableLeft;

        document
          .fillColor("#1F2937")
          .font("Helvetica")
          .fontSize(8.5);

        values.forEach((value, columnIndex) => {
          const width = columns[columnIndex]?.width ?? 90;

          document.text(value, x + 5, actualY + 7, {
            width: width - 10,
            height: rowHeight - 8,
            ellipsis: true,
          });

          if (columnIndex < values.length - 1) {
            document
              .moveTo(x + width, actualY)
              .lineTo(x + width, actualY + rowHeight)
              .strokeColor("#CBD5E1")
              .lineWidth(0.5)
              .stroke();
          }

          x += width;
        });

        document.y = actualY + rowHeight;
      };

      drawHeader();
      drawTableHeader();

      logs.forEach((log, index) => {
        drawRow(
          [
            formatValue(log.date),
            formatValue(log.start_time),
            formatValue(log.end_time),
            formatHours(log.total_driving_seconds),
            formatHours(log.total_work_seconds),
            `${Number(log.distance_km) || 0} km`,
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

      const { url } = await storagePut(
        `exports/drive-legal-report-${Date.now()}.pdf`,
        pdfBuffer,
        "application/pdf"
      );

      return res.json({ url });
    } catch (error: any) {
      console.error("[PDF EXPORT ERROR]", error);

      return res.status(500).json({
        error: error?.message || "PDF export failed.",
      });
    }
  });

  /* ─────────────────────────────────────────────
   EXCEL EXPORT
───────────────────────────────────────────── */
app.post("/api/export/excel", async (req: Request, res: Response) => {
  try {
    const {
      driverId,
      logs: requestLogs,
      driverName,
      licenceNumber,
      vehicleRego,
      driverType,
      password,
    } = req.body;

    if (!driverId) {
      return res.status(400).json({
        error: "driverId required",
      });
    }

    if (!Array.isArray(requestLogs) || requestLogs.length === 0) {
      return res.status(400).json({
        error: "No log records were supplied for export.",
      });
    }

    const logs = requestLogs;

    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0).name("Logs");

    sheet.cell("A1").value("DRIVE LEGAL LOGBOOK REPORT");
    sheet.cell("A1:F1").merged(true);
    sheet.cell("A1").style({
      bold: true,
      fill: "003366",
      fontColor: "FFFFFF",
      fontSize: 16,
      horizontalAlignment: "center",
    });

    sheet.cell("A2").value("Driver");
    sheet.cell("B2").value(driverName || "");
    sheet.cell("D2").value("Licence");
    sheet.cell("E2").value(licenceNumber || "");

    sheet.cell("A3").value("Vehicle Rego");
    sheet.cell("B3").value(vehicleRego || "");
    sheet.cell("D3").value("Driver Type");
    sheet.cell("E3").value(driverType || "");

    const headers = [
      "Date",
      "Start",
      "End",
      "Driving",
      "Work",
      "Breaks",
      "Distance",
    ];

    headers.forEach((header, index) => {
      sheet
        .cell(5, index + 1)
        .value(header)
        .style({
          bold: true,
          fill: "003366",
          fontColor: "FFFFFF",
          horizontalAlignment: "center",
        });
    });

    logs.forEach((log: any, index: number) => {
      const row = index + 6;

      const startTime = log.startTime ?? log.start_time ?? "";
      const endTime = log.endTime ?? log.end_time ?? "";

      const totalDrivingSeconds =
        Number(
          log.totalDrivingSeconds ??
            log.total_driving_seconds ??
            0
        ) || 0;

      const totalWorkSeconds =
        Number(
          log.totalWorkSeconds ??
            log.total_work_seconds ??
            0
        ) || 0;

      const totalBreakSeconds = Array.isArray(log.breaks)
        ? log.breaks.reduce(
            (sum: number, breakEntry: any) =>
              sum +
              (Number(
                breakEntry?.durationSeconds ??
                  breakEntry?.duration_seconds ??
                  0
              ) || 0),
            0
          )
        : 0;

      const distanceKm =
        Number(log.distanceKm ?? log.distance_km ?? 0) || 0;

      const startDate = startTime
        ? new Date(startTime)
        : null;

      const dateValue =
        startDate && !Number.isNaN(startDate.getTime())
          ? startDate.toLocaleDateString("en-NZ")
          : log.date ?? "";

      const startValue =
        startDate && !Number.isNaN(startDate.getTime())
          ? startDate.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : startTime;

      const endDate = endTime ? new Date(endTime) : null;

      const endValue =
        endDate && !Number.isNaN(endDate.getTime())
          ? endDate.toLocaleTimeString("en-NZ", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : endTime;

      sheet.cell(row, 1).value(dateValue);
      sheet.cell(row, 2).value(startValue);
      sheet.cell(row, 3).value(endValue);

      sheet
        .cell(row, 4)
        .value((totalDrivingSeconds / 3600).toFixed(2));

      sheet
        .cell(row, 5)
        .value((totalWorkSeconds / 3600).toFixed(2));

      sheet
        .cell(row, 6)
        .value((totalBreakSeconds / 3600).toFixed(2));

      sheet.cell(row, 7).value(distanceKm);
    });

    sheet.column("A").width(14);
    sheet.column("B").width(12);
    sheet.column("C").width(12);
    sheet.column("D").width(12);
    sheet.column("E").width(12);
    sheet.column("F").width(12);
    sheet.column("G").width(12);

    const cleanPassword =
      typeof password === "string" ? password.trim() : "";

    const buffer = await workbook.outputAsync(
      cleanPassword
        ? {
            password: cleanPassword,
          }
        : undefined
    );

    const { url } = await storagePut(
      `exports/logbook-${Date.now()}.xlsx`,
      Buffer.from(buffer),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.json({
      url,
      downloadUrl: url,
    });
  } catch (error: any) {
    console.error("[EXCEL EXPORT ERROR]", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate Excel export.",
    });
  }
});
  }
