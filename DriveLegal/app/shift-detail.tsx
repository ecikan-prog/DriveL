/**
 * Shift context for Drive Legal.
 * Manages active shifts, timers, GPS capture and NZTA compliance checks.
 *
 * Notifications are temporarily disabled while diagnosing an iOS startup crash.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuthContext } from "./auth-context";
import * as Logbook from "./logbook-storage";

import {
  evaluateCompliance,
  type ComplianceStatus,
} from "@/hooks/use-nzta-compliance";

import {
  getSubscriptionState,
  canLogShifts,
  type SubscriptionState,
} from "./subscription";

import { addToHashChain } from "./integrity";
import { captureLocation, type LocationData } from "./location";
import {
  validateRestPeriod,
  type RestValidationResult,
} from "./rest-validation";

type ShiftResult = {
  success: boolean;
  error?: string;
};

type ShiftContextValue = {
  activeShift: Logbook.ActiveShift | null;
  isShiftActive: boolean;
  isOnBreak: boolean;
  isOtherWork: boolean;

  /** Total driving across the complete shift. */
  drivingSeconds: number;

  /** Driving since the most recent qualifying break. */
  consecutiveDrivingSeconds: number;

  workSeconds: number;
  breakSeconds: number;
  fortnightlyDrivingSeconds: number;
  compliance: ComplianceStatus;

  startShift: (
    odometer?: number,
    restOverrideNote?: string
  ) => Promise<ShiftResult>;

  endShift: (odometer?: number) => Promise<Logbook.DailyLog | null>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  startOtherWork: (note?: string) => Promise<void>;
  endOtherWork: () => Promise<void>;

  changeVehicle: (
    registration: string,
    odometer: number,
    reason?: string
  ) => Promise<void>;

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

export function ShiftProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();

  const [activeShift, setActiveShift] =
    useState<Logbook.ActiveShift | null>(null);

  const [subscriptionState, setSubscriptionState] =
    useState<SubscriptionState | null>(null);

  const [drivingSeconds, setDrivingSeconds] = useState(0);
  const [consecutiveDrivingSeconds, setConsecutiveDrivingSeconds] =
    useState(0);
  const [workSeconds, setWorkSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [fortnightlyDrivingSeconds, setFortnightlyDrivingSeconds] =
    useState(0);

  const [compliance, setCompliance] =
    useState<ComplianceStatus>(NULL_COMPLIANCE);

  const [loading, setLoading] = useState(true);

  const [currentLocation, setCurrentLocation] =
    useState<LocationData | null>(null);

  const [restValidation, setRestValidation] =
    useState<RestValidationResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevWarningsRef = useRef<Set<string>>(new Set());

  /**
   * Notifications are intentionally disabled during startup-crash diagnosis.
   * This keeps compliance calculations running without invoking a native
   * notification TurboModule.
   */
  const sendWarningNotification = useCallback(
    async (_title: string, _body: string): Promise<void> => {
      return;
    },
    []
  );

  const loadFortnightly = useCallback(async (userId: string) => {
    const seconds =
      await Logbook.getFortnightlyDrivingSeconds(userId);

    setFortnightlyDrivingSeconds(seconds);
    return seconds;
  }, []);

  const tick = useCallback(
    (shift: Logbook.ActiveShift, fortnightlyBase: number) => {
      const now = Date.now();

      const driving =
        Logbook.computeCurrentDrivingSeconds(shift, now);

      const consecutive =
        Logbook.computeConsecutiveDrivingSeconds(shift, now);

      const work =
        Logbook.computeCurrentWorkSeconds(shift, now);

      const breakSecs =
        Logbook.computeCurrentBreakSeconds(shift, now);

      setDrivingSeconds(driving);
      setConsecutiveDrivingSeconds(consecutive);
      setWorkSeconds(work);
      setBreakSeconds(breakSecs);

      const totalFortnightly = fortnightlyBase + driving;
      const driverType =
        user?.driverType ?? "small_passenger";

      const nextCompliance = evaluateCompliance(
        consecutive,
        work,
        totalFortnightly,
        driverType
      );

      setCompliance(nextCompliance);

      for (const warning of nextCompliance.warnings) {
        if (!prevWarningsRef.current.has(warning.id)) {
          prevWarningsRef.current.add(warning.id);

          void sendWarningNotification(
            warning.title,
            warning.message
          );
        }
      }
    },
    [sendWarningNotification, user]
  );

  const startTimer = useCallback(
    (
      shift: Logbook.ActiveShift,
      fortnightlyBase: number
    ) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      tick(shift, fortnightlyBase);

      timerRef.current = setInterval(() => {
        tick(shift, fortnightlyBase);
      }, 1000);
    },
    [tick]
  );

  const stopTimer = useCallback(() => {
    if (!timerRef.current) return;

    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  /**
   * Restore the active shift after login or app relaunch.
   */
  useEffect(() => {
    let cancelled = false;

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
    ])
      .then(([shift, fortnightly]) => {
        if (cancelled) return;

        setFortnightlyDrivingSeconds(fortnightly);

        if (shift) {
          setActiveShift(shift);
          startTimer(shift, fortnightly);
        } else {
          setActiveShift(null);
          stopTimer();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveShift(null);
          stopTimer();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      stopTimer();
    };
  }, [user, startTimer, stopTimer]);

  /**
   * Refresh subscription status when the authenticated user changes.
   */
  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setSubscriptionState(null);
      return;
    }

    getSubscriptionState(user.id, user.trialStartDate)
      .then((state) => {
        if (!cancelled) {
          setSubscriptionState(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubscriptionState(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const isTrialExpired = subscriptionState
    ? !canLogShifts(subscriptionState)
    : false;

  const checkRestValidation =
    useCallback(async (): Promise<RestValidationResult> => {
      if (!user) {
        return { canStartShift: true };
      }

      const result = await validateRestPeriod(user.id);
      setRestValidation(result);

      return result;
    }, [user]);

  const startShift = useCallback(
    async (
      odometer?: number,
      restOverrideNote?: string
    ): Promise<ShiftResult> => {
      if (!user) {
        return {
          success: false,
          error: "Not logged in.",
        };
      }

      const nextSubscriptionState =
        await getSubscriptionState(
          user.id,
          user.trialStartDate
        );

      setSubscriptionState(nextSubscriptionState);

      if (!canLogShifts(nextSubscriptionState)) {
        return {
          success: false,
          error:
            "Your trial has expired. Please subscribe to continue logging shifts.",
        };
      }

      if (!restOverrideNote) {
        const restCheck =
          await validateRestPeriod(user.id);

        setRestValidation(restCheck);

        if (!restCheck.canStartShift) {
          const label =
            restCheck.restType === "cwp_reset"
              ? "24-Hour Rest Required"
              : "10-Hour Rest Required";

          return {
            success: false,
            error: `${label}: ${
              restCheck.reason ??
              "You must rest before starting a new shift."
            }`,
          };
        }
      }

      prevWarningsRef.current = new Set();

      const location = await captureLocation();
      setCurrentLocation(location);

      const locationData = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            displayName: location.displayName,
          }
        : undefined;

      const shift = await Logbook.startShift(user.id, {
        location: locationData,
        odometer,
        restOverrideNote,
      });

      const fortnightly =
        await loadFortnightly(user.id);

      setActiveShift(shift);
      startTimer(shift, fortnightly);

      return { success: true };
    },
    [user, loadFortnightly, startTimer]
  );

  const endShift = useCallback(
    async (
      odometer?: number
    ): Promise<Logbook.DailyLog | null> => {
      if (!user) return null;

      stopTimer();

      const location = await captureLocation();

      const locationData = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            displayName: location.displayName,
          }
        : undefined;

      const log = await Logbook.endShift(user.id, {
        location: locationData,
        odometer,
      });

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

      if (log) {
        import("./cloud-sync")
          .then(({ pushLogsToCloud }) => {
            pushLogsToCloud(user.id).catch(() => {});
          })
          .catch(() => {});
      }

      return log;
    },
    [user, stopTimer, loadFortnightly]
  );

  const startBreak = useCallback(async () => {
    if (!user || !activeShift) return;

    const location = await captureLocation();

    const locationData = location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          displayName: location.displayName,
        }
      : undefined;

    const updated = await Logbook.startBreak(user.id, {
      location: locationData,
    });

    if (!updated) return;

    setActiveShift(updated);
    stopTimer();
    startTimer(updated, fortnightlyDrivingSeconds);
  }, [
    user,
    activeShift,
    fortnightlyDrivingSeconds,
    startTimer,
    stopTimer,
  ]);

  const endBreak = useCallback(async () => {
    if (!user || !activeShift) return;

    const location = await captureLocation();

    const locationData = location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          displayName: location.displayName,
        }
      : undefined;

    const updated = await Logbook.endBreak(user.id, {
      location: locationData,
    });

    if (!updated) return;

    setActiveShift(updated);
    stopTimer();
    startTimer(updated, fortnightlyDrivingSeconds);
  }, [
    user,
    activeShift,
    fortnightlyDrivingSeconds,
    startTimer,
    stopTimer,
  ]);

  const startOtherWork = useCallback(
    async (note?: string) => {
      if (!user || !activeShift) return;

      const location = await captureLocation();

      const locationData = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            displayName: location.displayName,
          }
        : undefined;

      const updated = await Logbook.startOtherWork(
        user.id,
        {
          location: locationData,
          note,
        }
      );

      if (!updated) return;

      setActiveShift(updated);
      stopTimer();
      startTimer(updated, fortnightlyDrivingSeconds);
    },
    [
      user,
      activeShift,
      fortnightlyDrivingSeconds,
      startTimer,
      stopTimer,
    ]
  );

  const endOtherWork = useCallback(async () => {
    if (!user || !activeShift) return;

    const location = await captureLocation();

    const locationData = location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          displayName: location.displayName,
        }
      : undefined;

    const updated = await Logbook.endOtherWork(user.id, {
      location: locationData,
    });

    if (!updated) return;

    setActiveShift(updated);
    stopTimer();
    startTimer(updated, fortnightlyDrivingSeconds);
  }, [
    user,
    activeShift,
    fortnightlyDrivingSeconds,
    startTimer,
    stopTimer,
  ]);

  const changeVehicle = useCallback(
    async (
      registration: string,
      odometer: number,
      reason?: string
    ) => {
      if (!user || !activeShift) return;

      const updated =
        await Logbook.addVehicleChange(
          user.id,
          registration,
          odometer,
          reason
        );

      if (updated) {
        setActiveShift(updated);
      }
    },
    [user, activeShift]
  );

  const isShiftActive = activeShift !== null;

  const isOnBreak = activeShift
    ? Logbook.isCurrentlyOnBreak(activeShift)
    : false;

  const isOtherWork = activeShift
    ? Logbook.isCurrentlyOtherWork(activeShift)
    : false;

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
  const context = useContext(ShiftContext);

  if (!context) {
    throw new Error(
      "useShiftContext must be used within ShiftProvider"
    );
  }

  return context;
}
