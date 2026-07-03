/**
 * GPS Location capture and reverse geocoding for Drive Legal.
 * Records driver location at each shift event (start, break, end).
 * Uses expo-location on native and browser Geolocation API on web.
 */
import { Platform } from "react-native";

// Defensive import — if expo-location fails to load, location features gracefully degrade
let ExpoLocation: any = null;
try {
  ExpoLocation = require("expo-location");
} catch {
  // Module unavailable — location will return null
}

export type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  suburb: string;
  city: string;
  displayName: string; // "Suburb, City" or "City" if no suburb
  timestamp: string;
};

/**
 * Request location permissions. Returns true if granted.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === "web") {
    // Web uses browser Geolocation API — permission requested on use
    return true;
  }
  if (!ExpoLocation) return false;
  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Get the current GPS location with reverse geocoding.
 * Falls back gracefully if location is unavailable.
 */
export async function captureLocation(): Promise<LocationData | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    let coords: { latitude: number; longitude: number; accuracy: number | null };

    if (Platform.OS === "web") {
      // Use browser Geolocation API
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } else {
      // Use expo-location on native
      if (!ExpoLocation) return null;
      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy?.Balanced ?? 3,
      });
      coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
    }

    // Reverse geocode to get suburb/city
    const { suburb, city } = await reverseGeocode(coords.latitude, coords.longitude);

    const displayName = suburb && city
      ? `${suburb}, ${city}`
      : city || suburb || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      suburb,
      city,
      displayName,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("Location capture failed:", error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to suburb/city using expo-location.
 * Falls back to a simple fetch on web.
 */
async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ suburb: string; city: string }> {
  try {
    if (Platform.OS !== "web" && ExpoLocation) {
      const results = await ExpoLocation.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const place = results[0];
        return {
          suburb: place.subregion || place.district || "",
          city: place.city || place.region || "",
        };
      }
    } else {
      // Web fallback: use Nominatim (free, no API key)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`,
        { headers: { "User-Agent": "DriveLegal-App/1.0" } }
      );
      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};
        return {
          suburb: address.suburb || address.neighbourhood || address.hamlet || "",
          city: address.city || address.town || address.village || address.county || "",
        };
      }
    }
  } catch (error) {
    console.warn("Reverse geocoding failed:", error);
  }
  return { suburb: "", city: "" };
}
