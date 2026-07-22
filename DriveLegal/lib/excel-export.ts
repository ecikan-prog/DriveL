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

  const serverOrigin = new URL(apiBaseUrl).origin;

  return new URL(trimmedUrl, serverOrigin).toString();
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
    let downloadedFile: File;

try {
  console.log("[EXCEL DOWNLOAD URL]", downloadUrl);

  const testResponse = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      Accept:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
    },
  });

  const contentType =
    testResponse.headers.get("content-type") ?? "unknown";

  console.log("[EXCEL DOWNLOAD RESPONSE]", {
    status: testResponse.status,
    contentType,
    url: testResponse.url,
  });

  if (!testResponse.ok) {
    const errorBody = await testResponse
      .text()
      .catch(() => "");

    throw new Error(
      `Download server returned ${testResponse.status}. ` +
        `${errorBody.slice(0, 200)}`
    );
  }

  const bytes = new Uint8Array(
    await testResponse.arrayBuffer()
  );

  if (bytes.length === 0) {
    throw new Error(
      "The server returned an empty Excel file."
    );
  }

  destinationFile.write(bytes);
  downloadedFile = destinationFile;
} catch (error: any) {
  console.error("[EXCEL DOWNLOAD ERROR]", error);

  throw new Error(
    error?.message ||
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
