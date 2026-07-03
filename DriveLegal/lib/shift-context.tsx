/**
 * Shift context for Guided NZ Logbook.
 * Manages the active shift state, timers, and NZTA compliance checks.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as Logbook from "./logbook-storage";
import { evaluateCompliance, type ComplianceStatus } from "@/hooks/use-nzta-compliance";
import { useAuthContext } from "./auth-context";
// Notifications is used defensively — if the module fails to load, we skip notifications
let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
} catch {
  // Module unavailable — notifications will be silently skipped
}
import { Platform } from "react-native";
import { getSubscriptionState, canLogShifts, type SubscriptionState } from "./subscription";
import { addToHashChain } from "./integrity";
import { captureLocation, type LocationData } from "./location";
import { validateRestPeriod, type RestValidationResult } from "./rest-validation";


type ShiftContextValue = {
  activeShift: Logbook.ActiveShift | null;
  isShiftActive: boolean;
  isOnBreak: boolean;
  isOtherWork: boolean;
  /** Total driving across the full shift — used for End Shift summary */
  drivingSeconds: number;
  /** Consecutive driving since last qualifying break — used for dashboard countdown */
  consecutiveDrivingSeconds: number;
  workSeconds: number;
  breakSeconds: number;
  fortnightlyDrivingSeconds: number;
  compliance: ComplianceStatus;
  startShift: (odometer?: number, restOverrideNote?: string) => Promise<{ success: boolean; error?: string }>;
  endShift: (odometer?: number) => Promise<Logbook.DailyLog | null>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  startOtherWork: (note?: string) => Promise<void>;
  endOtherWork: () => Promise<void>;
  changeVehicle: (registration: string, odometer: number, reason?: string) => Promise<void>;
  loading: boolean;
  subscriptionState: SubscriptionState | null;
  isTrialExpired: boolean;
  currentLocation: LocationData | null;
  restValidation: RestValidationResult | null;
  checkRestValidation: () => Promise<RestValidationResult>;
};

const ShiftContext = createContext<ShiftContextValue | null>(null);

const NULL_COMPLIANCE: ComplianceStatus = {
  warnings: [],
  isDrivingWarning: false,
  isDrivingWarning15Min: false,
  isDrivingWarning5Min: false,
  isWorkWarning: false,
  isFortnightWarning: false,
  isFortnightCritical: false,
  isCwp15MinWarning: false,
  isCwp5MinWarning: false,
};

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [activeShift, setActiveShift] = useState<Logbook.ActiveShift | null>(null);
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState | null>(null);
  const [drivingSeconds, setDrivingSeconds] = useState(0);
  const [consecutiveDrivingSeconds, setConsecutiveDrivingSeconds] = useState(0);
  const [workSeconds, setWorkSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [fortnightlyDrivingSeconds, setFortnightlyDrivingSeconds] = useState(0);
  const [compliance, setCompliance] = useState<ComplianceStatus>(NULL_COMPLIANCE);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevWarningsRef = useRef<Set<string>>(new Set());

  // Request notification permissions on mount
  useEffect(() => {
    if (Platform.OS !== "web" && Notifications) {
      try {
        Notifications.requestPermissionsAsync().catch(() => {});
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch {
        // Notifications module failed — skip silently
      }
    }
  }, []);

  const sendWarningNotification = useCallback(
    async (title: string, body: string) => {
      if (Platform.OS === "web" || !Notifications) return;
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title, body, sound: true },
          trigger: null,
        });
      } catch {
        // Silently fail if notifications not permitted
      }
    },
    []
  );

  const loadFortnightly = useCallback(async (userId: string) => {
    const seconds = await Logbook.getFortnightlyDrivingSeconds(userId);
    setFortnightlyDrivingSeconds(seconds);
    return seconds;
  }, []);

  const tick = useCallback(
    (shift: Logbook.ActiveShift, fortnightlyBase: number) => {
      const now = Date.now();
      const driving = Logbook.computeCurrentDrivingSeconds(shift, now);
      const consecutive = Logbook.computeConsecutiveDrivingSeconds(shift, now);
      const work = Logbook.computeCurrentWorkSeconds(shift, now);
      const breakSecs = Logbook.computeCurrentBreakSeconds(shift, now);

      setDrivingSeconds(driving);
      setConsecutiveDrivingSeconds(consecutive);
      setWorkSeconds(work);
      setBreakSeconds(breakSecs);

      // Compliance uses consecutive driving for break warnings,
      // and total fortnightly (base + current shift total) for CWP
      const totalFortnightly = fortnightlyBase + driving;
      const driverType = user?.driverType || "small_passenger";
      const newCompliance = evaluateCompliance(consecutive, work, totalFortnightly, driverType);
      setCompliance(newCompliance);

      // Fire notifications for new warnings
      for (const warning of newCompliance.warnings) {
        if (!prevWarningsRef.current.has(warning.id)) {
          prevWarningsRef.current.add(warning.id);
          sendWarningNotification(warning.title, warning.message);
        }
      }
    },
    [sendWarningNotification, user]
  );

  const startTimer = useCallback(
    (shift: Logbook.ActiveShift, fortnightlyBase: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      tick(shift, fortnightlyBase);
      timerRef.current = setInterval(() => tick(shift, fortnightlyBase), 1000);
    },
    [tick]
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Load active shift on mount / user change
  useEffect(() => {
    if (!user) {
      setActiveShift(null);
      setLoading(false);
      stopTimer();
      return;
    }

    setLoading(true);
    Promise.all([
      Logbook.getActiveShift(user.id),
      Logbook.getFortnightlyDrivingSeconds(user.id),
    ]).then(([shift, fortnightly]) => {
      setFortnightlyDrivingSeconds(fortnightly);
      if (shift) {
        setActiveShift(shift);
        startTimer(shift, fortnightly);
      }
      setLoading(false);
    });

    return () => stopTimer();
  }, [user, startTimer, stopTimer]);

  // Load subscription state when user changes
  useEffect(() => {
    if (!user) {
      setSubscriptionState(null);
      return;
    }
    getSubscriptionState(user.id, user.trialStartDate).then(setSubscriptionState);
  }, [user]);

  const isTrialExpired = subscriptionState ? !canLogShifts(subscriptionState) : false;

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);

  const [restValidation, setRestValidation] = useState<RestValidationResult | null>(null);

  const checkRestValidation = useCallback(async (): Promise<RestValidationResult> => {
    if (!user) return { canStartShift: true };
    const result = await validateRestPeriod(user.id);
    setRestValidation(result);
    return result;
  }, [user]);

  const startShift = useCallback(async (odometer?: number, restOverrideNote?: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not logged in." };
    // Refresh subscription state before allowing shift start
    const subState = await getSubscriptionState(user.id, user.trialStartDate);
    setSubscriptionState(subState);
    if (!canLogShifts(subState)) {
      // Trial expired and no subscription — block
      return { success: false, error: "Your trial has expired. Please subscribe to continue logging shifts." };
    }
    // Validate rest period — NZTA requirement
    // Skip rest validation only when driver has provided an override note (unavoidable delay/emergency)
    if (!restOverrideNote) {
      const restCheck = await validateRestPeriod(user.id);
      setRestValidation(restCheck);
      if (!restCheck.canStartShift) {
        const label = restCheck.restType === "cwp_reset" ? "24-Hour Rest Required" : "10-Hour Rest Required";
        return { success: false, error: `${label}: ${restCheck.reason ?? "You must rest before starting a new shift."}` };
      }
    }
    prevWarningsRef.current = new Set();
    // Capture GPS location
    const loc = await captureLocation();
    setCurrentLocation(loc);
    const locationData = loc ? { latitude: loc.latitude, longitude: loc.longitude, displayName: loc.displayName } : undefined;
    const shift = await Logbook.startShift(user.id, { location: locationData, odometer, restOverrideNote });
    const fortnightly = await loadFortnightly(user.id);
    setActiveShift(shift);
    startTimer(shift, fortnightly);
    return { success: true };
  }, [user, loadFortnightly, startTimer]);

  const endShift = useCallback(async (odometer?: number): Promise<Logbook.DailyLog | null> => {
    if (!user) return null;
    stopTimer();
    // Capture GPS location at end
    const loc = await captureLocation();
    const locationData = loc ? { latitude: loc.latitude, longitude: loc.longitude, displayName: loc.displayName } : undefined;
    const log = await Logbook.endShift(user.id, { location: locationData, odometer });
    // Add to tamper-evident hash chain
    if (log) {
      await addToHashChain(log);
    }
    setActiveShift(null);
    setCurrentLocation(null);
    setDrivingSeconds(0);
    setConsecutiveDrivingSeconds(0);
    setWorkSeconds(0);
    setBreakSeconds(0);
    setCompliance(NULL_COMPLIANCE);
    prevWarningsRef.current = new Set();
    await loadFortnightly(user.id);
    // Background: push completed shift to cloud
    if (log) {
      import("./cloud-sync").then(({ pushLogsToCloud }) => {
        pushLogsToCloud(user.id).catch(() => {});
      }).catch(() => {});
    }
    return log;
  }, [user, stopTimer, loadFortnightly]);

  const startBreak = useCallback(async () => {
    if (!user || !activeShift) return;
    const loc = await captureLocation();
    const locationData = loc ? { latitude: loc.latitude, longitude: loc.longitude, displayName: loc.displayName } : undefined;
    const updated = await Logbook.startBreak(user.id, { location: locationData });
    if (updated) {
      setActiveShift(updated);
      stopTimer();
      startTimer(updated, fortnightlyDrivingSeconds);
    }
  }, [user, activeShift, fortnightlyDrivingSeconds, startTimer, stopTimer]);

  const endBreak = useCallback(async () => {
    if (!user || !activeShift) return;
    const loc = await captureLocation();
    const locationData = loc ? { latitude: loc.latitude, longitude: loc.longitude, displayName: loc.displayName } : undefined;
    const updated = await Logbook.endBreak(user.id, { location: locationData });
    if (updated) {
      setActiveShift(updated);
      stopTimer();
      startTimer(updated, fortnightlyDrivingSeconds);
    }
  }, [user, activeShift, fortnightlyDrivingSeconds, startTimer, stopTimer]);

  const startOtherWork = useCallback(async (note?: string) => {
    if (!user || !activeShift) return;
    const loc = await captureLocation();
    const locationData = loc ? { latitude: loc.latitude, longitude: loc.longitude, displayName: loc.displayName } : undefined;
    const updated = await Logbook.startOtherWork(user.id, { location: locationData, note });
    if (updated) {
      setActiveShift(updated);
      stopTimer();
      startTimer(updated, fortnightlyDrivingSeconds);
    }
  }, [user, activeShift, fortnightlyDrivingSeconds, startTimer, stopTimer]);

  const endOtherWork = useCallback(async () => {
    if (!user || !activeShift) return;
    const loc = await captureLocation();
    const locationData = loc ? { latitude: loc.latitude, longitude: loc.longitude, displayName: loc.displayName } : undefined;
    const updated = await Logbook.endOtherWork(user.id, { location: locationData });
    if (updated) {
      setActiveShift(updated);
      stopTimer();
      startTimer(updated, fortnightlyDrivingSeconds);
    }
  }, [user, activeShift, fortnightlyDrivingSeconds, startTimer, stopTimer]);

  const changeVehicle = useCallback(async (registration: string, odometer: number, reason?: string) => {
    if (!user || !activeShift) return;
    const updated = await Logbook.addVehicleChange(user.id, registration, odometer, reason);
    if (updated) {
      setActiveShift(updated);
    }
  }, [user, activeShift]);

  const isShiftActive = activeShift !== null;
  const isOnBreak = activeShift ? Logbook.isCurrentlyOnBreak(activeShift) : false;
  const isOtherWork = activeShift ? Logbook.isCurrentlyOtherWork(activeShift) : false;

  return (
    <ShiftContext.Provider
      value={{
        activeShift,
        isShiftActive,
        isOnBreak,
        isOtherWork,
        drivingSeconds,
        consecutiveDrivingSeconds,
        workSeconds,
        breakSeconds,
        fortnightlyDrivingSeconds,
        compliance,
        startShift,
        endShift,
        startBreak,
        endBreak,
        startOtherWork,
        endOtherWork,
        changeVehicle,
        loading,
        subscriptionState,
        isTrialExpired,
        currentLocation,
        restValidation,
        checkRestValidation,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShiftContext(): ShiftContextValue {
  const ctx = useContext(ShiftContext);
  if (!ctx) {
    throw new Error("useShiftContext must be used within ShiftProvider");
  }
  return ctx;
}
