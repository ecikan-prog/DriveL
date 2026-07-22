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

function createSafeFileName(fileName?: string): string {
  const fallbackName = `drive-legal-logbook-${Date.now()}.xlsx`;

  if (
    typeof fileName !== "string" ||
    fileName.trim() === ""
  ) {
    return fallbackName;
  }

  const lastPart =
    fileName.trim().split("/").pop() || fallbackName;

  const safeName = lastPart.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );

  return safeName.toLowerCase().endsWith(".xlsx")
    ? safeName
    : `${safeName}.xlsx`;
}

/**
 * Sends logbook records to the backend, downloads the generated Excel file
 * into the app cache, and opens the native iOS/Android share sheet.
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

  /*
   * Step 1: Ask the server to generate the Excel file.
   */
  const exportResponse = await fetch(
    `${apiBaseUrl}/api/export/excel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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
    await exportResponse.json().catch(() => ({
      error:
        "The server returned an invalid export response.",
    }));

  if (!exportResponse.ok) {
    throw new Error(
      result.error ||
        `Excel export failed with server status ${exportResponse.status}.`
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

  const fileName = createSafeFileName(
    result.fileName
  );

  const destinationFile = new File(
    Paths.cache,
    fileName
  );

  if (destinationFile.exists) {
    destinationFile.delete();
  }

  /*
   * Step 2: Download the generated file ourselves.
   * This exposes the real HTTP error instead of hiding it.
   */
  let downloadedFile: File;

  try {
    console.log(
      "[EXCEL DOWNLOAD URL]",
      downloadUrl
    );

    const downloadResponse = await fetch(
      downloadUrl,
      {
        method: "GET",
        headers: {
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*",
        },
      }
    );

    const contentType =
      downloadResponse.headers.get(
        "content-type"
      ) ?? "unknown";

    console.log(
      "[EXCEL DOWNLOAD RESPONSE]",
      {
        status: downloadResponse.status,
        contentType,
        url: downloadResponse.url,
      }
    );

    if (!downloadResponse.ok) {
      const errorBody = await downloadResponse
        .text()
        .catch(() => "");

      throw new Error(
        `Download server returned ${downloadResponse.status}. ` +
          errorBody.slice(0, 200)
      );
    }

    const arrayBuffer =
      await downloadResponse.arrayBuffer();

    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length === 0) {
      throw new Error(
        "The server returned an empty Excel file."
      );
    }

    destinationFile.write(bytes);
    downloadedFile = destinationFile;
  } catch (error: unknown) {
    console.error(
      "[EXCEL DOWNLOAD ERROR]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "The Excel file was generated, but it could not be downloaded.";

    throw new Error(message);
  }

  /*
   * Step 3: Confirm that a real file was written.
   */
  if (
    !downloadedFile.exists ||
    downloadedFile.size <= 0
  ) {
    throw new Error(
      "The downloaded Excel file is empty or unavailable."
    );
  }

  /*
   * Step 4: Open the native share/save sheet.
   */
  const sharingAvailable =
    await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      "File sharing is not available on this device."
    );
  }

  try {
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
  } catch (error: unknown) {
    console.error(
      "[EXCEL SHARING ERROR]",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "The Excel file was downloaded, but the share window could not be opened.";

    throw new Error(message);
  }
}
