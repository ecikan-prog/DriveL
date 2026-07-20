import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getApiBaseUrl } from "@/lib/api-base-url";
import type { DailyLog } from "@/lib/logbook-storage";

type GenerateExcelOptions = {
  driverId?: string | number | null;
  logs: DailyLog[];
  driverName: string;
  licenceNumber: string;
  vehicleRego: string;
  driverType: string;
  password?: string;
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
 * Sends logbook records to the backend, downloads the generated Excel file
 * into the app cache, and opens the native share sheet.
 */
export async function generateAndShareExcel({
  driverId,
  logs,
  driverName,
  licenceNumber,
  vehicleRego,
  driverType,
  password,
}: GenerateExcelOptions): Promise<void> {
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

  const safePassword =
    typeof password === "string"
      ? password.trim()
      : "";

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
    `${apiBaseUrl}/api/export/excel`,
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
        vehicleRego: vehicleRego ?? "",
        vehicleRegistration: vehicleRego ?? "",
        driverType:
          driverType ?? "small_passenger",
        password: safePassword || undefined,
        protected: Boolean(safePassword),
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
        `Excel export failed with server status ${response.status}.`
    );
  }

  const returnedUrl =
    result.downloadUrl ?? result.url;

  if (
    typeof returnedUrl !== "string" ||
    returnedUrl.trim() === ""
  ) {
    throw new Error(
      "The server did not return an Excel download link."
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
        `drive-legal-logbook-${Date.now()}.xlsx`
      : `drive-legal-logbook-${Date.now()}.xlsx`;

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
      "[EXCEL DOWNLOAD ERROR]",
      error
    );

    throw new Error(
      "The Excel file was generated, but it could not be downloaded."
    );
  }

  if (
    !downloadedFile.exists ||
    downloadedFile.size <= 0
  ) {
    throw new Error(
      "The downloaded Excel file is empty or unavailable."
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
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      UTI:
        "org.openxmlformats.spreadsheetml.sheet",
      dialogTitle:
        "Share Drive Legal Excel Report",
    }
  );
}
