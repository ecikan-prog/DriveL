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
      const { driverId } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      const logs = await query<any[]>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

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
      const { driverId, password } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      const logs = await query<any[]>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

      const workbook = await XlsxPopulate.fromBlankAsync();
      const sheet = workbook.sheet(0).name("Logs");

      const headers = [
        "Date",
        "Start",
        "End",
        "Driving",
        "Work",
        "Distance",
      ];

      headers.forEach((header, index) => {
        sheet
          .cell(1, index + 1)
          .value(header)
          .style({
            bold: true,
            fill: "003366",
            fontColor: "FFFFFF",
          });
      });

      logs.forEach((log, index) => {
        const row = index + 2;

        sheet.cell(row, 1).value(log.date);
        sheet.cell(row, 2).value(log.start_time);
        sheet.cell(row, 3).value(log.end_time);
        sheet
          .cell(row, 4)
          .value(
            ((log.total_driving_seconds || 0) / 3600).toFixed(2)
          );
        sheet
          .cell(row, 5)
          .value(((log.total_work_seconds || 0) / 3600).toFixed(2));
        sheet.cell(row, 6).value(log.distance_km || 0);
      });

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

      return res.json({ url });
    } catch (error: any) {
      console.error("[EXCEL EXPORT ERROR]", error);

      return res.status(500).json({
        error: error?.message || "Excel export failed.",
      });
    }
  });
}
