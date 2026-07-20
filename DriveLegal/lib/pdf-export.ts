import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getApiBaseUrl } from "@/lib/api-base-url";
import type { DailyLog } from "@/lib/logbook-storage";

type GeneratePDFOptions = {
  driverId?: string | number | null;
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
  fileName?: string;
  error?: string;
};

function createAbsoluteUrl(
  returnedUrl: string,
  apiBaseUrl: string
): string {
  const trimmedUrl = returnedUrl.trim();

  if (
    trimmedUrl.startsWith("https://") ||
    trimmedUrl.startsWith("http://")
  ) {
    return trimmedUrl;
  }

  return new URL(trimmedUrl, apiBaseUrl).toString();
}

/**
 * Sends logbook records to the backend, downloads the generated PDF
 * into the app cache, and opens the native share sheet.
 */
export async function generateAndSharePDF({
  driverId,
  logs,
  driverName,
  licenceNumber,
  vehicleRegistration,
  vehicleType,
  driverType,
}: GeneratePDFOptions): Promise<void> {
  const safeDriverId = String(driverId ?? "").trim();

  if (!safeDriverId) {
    throw new Error(
      "Driver ID is missing. Please sign out and sign in again."
    );
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error(
      "No shift records are available to export."
    );
  }

  const safeLogs = logs.map((log) => ({
    ...log,
    breaks: Array.isArray(log.breaks)
      ? log.breaks
      : [],
    events: Array.isArray(log.events)
      ? log.events
      : [],
    totalDrivingSeconds:
      Number(log.totalDrivingSeconds) || 0,
    totalWorkSeconds:
      Number(log.totalWorkSeconds) || 0,
  }));

  const apiBaseUrl = getApiBaseUrl()
    .trim()
    .replace(/\/+$/, "");

  if (!apiBaseUrl) {
    throw new Error(
      "The Drive Legal server address is not configured."
    );
  }

  const response = await fetch(
    `${apiBaseUrl}/api/export/pdf`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        driverId: safeDriverId,
        logs: safeLogs,
        driverName: driverName ?? "",
        licenceNumber: licenceNumber ?? "",
        vehicleRegistration:
          vehicleRegistration ?? "",
        vehicleRego:
          vehicleRegistration ?? "",
        vehicleType: vehicleType ?? "",
        driverType:
          driverType ?? "small_passenger",
        platform: Platform.OS,
      }),
    }
  );

  const result: ExportResponse =
    await response.json().catch(() => ({
      error:
        "The server returned an invalid response.",
    }));

  if (!response.ok) {
    throw new Error(
      result.error ||
        `PDF export failed with server status ${response.status}.`
    );
  }

  const returnedUrl =
    result.downloadUrl ?? result.url;

  if (
    typeof returnedUrl !== "string" ||
    returnedUrl.trim() === ""
  ) {
    throw new Error(
      "The server did not return a PDF download link."
    );
  }

  const downloadUrl = createAbsoluteUrl(
    returnedUrl,
    apiBaseUrl
  );

  const fileName =
    typeof result.fileName === "string" &&
    result.fileName.trim() !== ""
      ? result.fileName.split("/").pop() ??
        `drive-legal-report-${Date.now()}.pdf`
      : `drive-legal-report-${Date.now()}.pdf`;

  const destinationFile = new File(
    Paths.cache,
    fileName
  );

  if (destinationFile.exists) {
    destinationFile.delete();
  }

  let downloadedFile: File;

  try {
    downloadedFile =
      await File.downloadFileAsync(
        downloadUrl,
        destinationFile
      );
  } catch (error) {
    console.error(
      "[PDF DOWNLOAD ERROR]",
      error
    );

    throw new Error(
      "The PDF was generated, but it could not be downloaded."
    );
  }

  if (
    !downloadedFile.exists ||
    downloadedFile.size <= 0
  ) {
    throw new Error(
      "The downloaded PDF is empty or unavailable."
    );
  }

  const sharingAvailable =
    await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      "File sharing is not available on this device."
    );
  }

  await Sharing.shareAsync(
    downloadedFile.uri,
    {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle:
        "Share Drive Legal PDF Report",
    }
  );
}
