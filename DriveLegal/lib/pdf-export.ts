import { Linking, Platform } from "react-native";

import { getApiBaseUrl } from "@/lib/api-base-url";
import type { DailyLog } from "@/lib/logbook-storage";

type GeneratePDFOptions = {
  logs: DailyLog[];
  driverName: string;
  licenceNumber: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType: string;
};

type ExportResponse = {
  url?: string;
  downloadUrl?: string;
  error?: string;
};

/**
 * Sends logbook data to the Drive Legal backend.
 * The backend creates the PDF report and returns a downloadable URL.
 */
export async function generateAndSharePDF({
  logs,
  driverName,
  licenceNumber,
  vehicleRegistration,
  vehicleType,
  driverType,
}: GeneratePDFOptions): Promise<void> {
  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("No shift records are available to export.");
  }

  const safeLogs = logs.map((log) => ({
    ...log,
    breaks: log.breaks ?? [],
    events: log.events ?? [],
    totalDrivingSeconds: log.totalDrivingSeconds ?? 0,
    totalWorkSeconds: log.totalWorkSeconds ?? 0,
  }));

  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    throw new Error("The Drive Legal server address is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}/api/export/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      logs: safeLogs,
      driverName,
      licenceNumber,
      vehicleRegistration,
      vehicleType,
      driverType,
      platform: Platform.OS,
    }),
  });

  const result: ExportResponse = await response.json().catch(() => ({
    error: "The server returned an invalid response.",
  }));

  if (!response.ok) {
    throw new Error(
      result.error ||
        `PDF export failed with server status ${response.status}.`
    );
  }

  const downloadUrl = result.downloadUrl ?? result.url;

  if (!downloadUrl) {
    throw new Error("The server did not return a PDF download link.");
  }

  const canOpen = await Linking.canOpenURL(downloadUrl);

  if (!canOpen) {
    throw new Error("The generated PDF download link cannot be opened.");
  }

  await Linking.openURL(downloadUrl);
}
