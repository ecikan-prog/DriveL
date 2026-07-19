import { Express, Request, Response } from "express";
import XlsxPopulate from "xlsx-populate";

import { storagePut } from "./storage";

/**
 * Password-protected Excel export endpoint.
 * Uses log records supplied by the mobile app.
 */
export function excelProtectedRouter(app: Express) {
  app.post(
    "/api/export/excel-protected",
    async (req: Request, res: Response) => {
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

        if (
          !Array.isArray(requestLogs) ||
          requestLogs.length === 0
        ) {
          return res.status(400).json({
            error: "No log records were supplied for export.",
          });
        }

        const logs = requestLogs;

        const workbook = await XlsxPopulate.fromBlankAsync();
        const sheet = workbook.sheet(0).name("Logs");

        sheet.cell("A1").value("DRIVE LEGAL LOGBOOK REPORT");
        sheet.cell("A1:G1").merged(true);
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
          "Start Time",
          "End Time",
          "Driving Hours",
          "Work Hours",
          "Break Hours",
          "Distance (km)",
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

          const startTime =
            log.startTime ?? log.start_time ?? "";

          const endTime =
            log.endTime ?? log.end_time ?? "";

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
            Number(
              log.distanceKm ??
                log.distance_km ??
                0
            ) || 0;

          const startDate = startTime
            ? new Date(startTime)
            : null;

          const endDate = endTime
            ? new Date(endTime)
            : null;

          const dateValue =
            startDate &&
            !Number.isNaN(startDate.getTime())
              ? startDate.toLocaleDateString("en-NZ")
              : log.date ?? "";

          const startValue =
            startDate &&
            !Number.isNaN(startDate.getTime())
              ? startDate.toLocaleTimeString("en-NZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : startTime;

          const endValue =
            endDate &&
            !Number.isNaN(endDate.getTime())
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
        sheet.column("B").width(14);
        sheet.column("C").width(14);
        sheet.column("D").width(15);
        sheet.column("E").width(13);
        sheet.column("F").width(13);
        sheet.column("G").width(14);

        const cleanPassword =
          typeof password === "string"
            ? password.trim()
            : "";

        const buffer = await workbook.outputAsync(
          cleanPassword
            ? {
                password: cleanPassword,
              }
            : undefined
        );

        const filename =
          `protected-export-${Date.now()}.xlsx`;

        const { url } = await storagePut(
          `exports/${filename}`,
          Buffer.from(buffer),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        return res.json({
          success: true,
          url,
          downloadUrl: url,
        });
      } catch (error: any) {
        console.error(
          "[EXCEL PROTECTED ERROR]",
          error
        );

        return res.status(500).json({
          error:
            error?.message ||
            "Failed to generate protected Excel export.",
        });
      }
    }
  );
}
