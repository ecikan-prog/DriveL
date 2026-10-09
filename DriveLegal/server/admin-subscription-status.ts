/**
 * Admin-facing subscription status.
 *
 * The backend `drivers` row is the authoritative source for paid
 * subscription state (subscriptionStatus / subscriptionPlan /
 * subscriptionId / currentPeriodEnd are written by driverAuth.syncSubscription
 * and the App Store Server Notification webhook after Apple validation).
 *
 * The trial start date is only used when the account has no paid
 * subscription record, so a historical expired trial can never override a
 * subsequently purchased subscription.
 */

export const TRIAL_DAYS = 21;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type TrialStatus = {
  label: string;
  shortLabel: string;
  daysLeft: number | null;
  expired: boolean;
  started: boolean;
  expiryDate: Date | null;
  className: "trial" | "expired" | "neutral";
};

export type AdminSubscriptionKind =
  | "active"
  | "billing_issue"
  | "cancelled"
  | "expired"
  | "trial"
  | "trial_expired"
  | "not_started";

export type AdminSubscriptionStatus = {
  kind: AdminSubscriptionKind;
  label: string;
  className: "active" | "trial" | "warning" | "expired" | "neutral";
  plan: "monthly" | "annual" | null;
  /** Renewal / expiry date relevant to the current status, if known. */
  date: Date | null;
  /** Describes what `date` represents (e.g. "Renews", "Trial expired"). */
  dateLabel: string | null;
  /** True when the status is derived from a paid subscription record. */
  paid: boolean;
  trial: TrialStatus;
};

export type AdminSubscriptionInput = {
  trialStartDate?: unknown;
  subscriptionStatus?: unknown;
  subscriptionPlan?: unknown;
  subscriptionId?: unknown;
  currentPeriodEnd?: unknown;
};

export type AdminSubscriptionSummary = {
  total: number;
  activeSubscriptions: number;
  billingIssues: number;
  cancelled: number;
  expiredSubscriptions: number;
  activeTrials: number;
  expiredTrials: number;
  notStarted: number;
};

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalisePlan(value: unknown): "monthly" | "annual" | null {
  return value === "monthly" || value === "annual" ? value : null;
}

function hasText(value: unknown): boolean {
  return typeof value === "string"
    ? value.trim().length > 0
    : value !== null && value !== undefined;
}

function planLabel(plan: "monthly" | "annual" | null): string {
  if (plan === "monthly") return "Monthly";
  if (plan === "annual") return "Annual";
  return "";
}

export function getTrialStatus(
  trialStartValue: unknown,
  now: number = Date.now(),
): TrialStatus {
  const trialStart = trialStartValue ? parseDate(trialStartValue) : null;

  if (!trialStart) {
    return {
      label: "Trial not started",
      shortLabel: "Not started",
      daysLeft: null,
      expired: false,
      started: false,
      expiryDate: null,
      className: "neutral",
    };
  }

  const expiryDate = new Date(trialStart.getTime() + TRIAL_DAYS * ONE_DAY_MS);
  const millisecondsRemaining = expiryDate.getTime() - now;
  const expired = millisecondsRemaining <= 0;
  const daysLeft = expired ? 0 : Math.ceil(millisecondsRemaining / ONE_DAY_MS);

  return {
    label: expired
      ? "Trial expired"
      : `Trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
    shortLabel: expired ? "Expired" : `${daysLeft}d left`,
    daysLeft,
    expired,
    started: true,
    expiryDate,
    className: expired ? "expired" : "trial",
  };
}

export function getAdminSubscriptionStatus(
  driver: AdminSubscriptionInput,
  now: number = Date.now(),
): AdminSubscriptionStatus {
  const trial = getTrialStatus(driver.trialStartDate, now);
  const status = driver.subscriptionStatus;
  const plan = normalisePlan(driver.subscriptionPlan);
  const periodEnd = parseDate(driver.currentPeriodEnd);
  const periodEnded = periodEnd !== null && periodEnd.getTime() <= now;
  const planSuffix = plan ? ` · ${planLabel(plan)}` : "";

  if (status === "active") {
    if (periodEnded) {
      // Backend still records the subscription as active but the paid
      // period has passed without a confirmed renewal (e.g. Apple billing
      // retry / grace period, or a renewal notification not yet received).
      return {
        kind: "billing_issue",
        label: `Billing issue · renewal overdue${planSuffix}`,
        className: "warning",
        plan,
        date: periodEnd,
        dateLabel: "Period ended",
        paid: true,
        trial,
      };
    }

    return {
      kind: "active",
      label: `Active${planSuffix}`,
      className: "active",
      plan,
      date: periodEnd,
      dateLabel: periodEnd ? "Renews" : null,
      paid: true,
      trial,
    };
  }

  if (status === "cancelled") {
    return {
      kind: "cancelled",
      label: periodEnd && !periodEnded
        ? `Cancelled · ends at period end${planSuffix}`
        : `Cancelled${planSuffix}`,
      className: "warning",
      plan,
      date: periodEnd,
      dateLabel: periodEnd ? (periodEnded ? "Ended" : "Access ends") : null,
      paid: true,
      trial,
    };
  }

  const hasPaidHistory =
    status === "expired" &&
    (hasText(driver.subscriptionId) || plan !== null || periodEnd !== null);

  if (hasPaidHistory) {
    return {
      kind: "expired",
      label: `Subscription expired${planSuffix}`,
      className: "expired",
      plan,
      date: periodEnd,
      dateLabel: periodEnd ? "Ended" : null,
      paid: true,
      trial,
    };
  }

  // No paid subscription on record — fall back to the trial calculation.
  if (!trial.started) {
    return {
      kind: "not_started",
      label: trial.label,
      className: "neutral",
      plan: null,
      date: null,
      dateLabel: null,
      paid: false,
      trial,
    };
  }

  return {
    kind: trial.expired ? "trial_expired" : "trial",
    label: trial.label,
    className: trial.className,
    plan: null,
    date: trial.expiryDate,
    dateLabel: trial.expired ? "Trial expired" : "Trial ends",
    paid: false,
    trial,
  };
}

export function summariseAdminSubscriptionStatuses(
  drivers: AdminSubscriptionInput[],
  now: number = Date.now(),
): AdminSubscriptionSummary {
  const summary: AdminSubscriptionSummary = {
    total: drivers.length,
    activeSubscriptions: 0,
    billingIssues: 0,
    cancelled: 0,
    expiredSubscriptions: 0,
    activeTrials: 0,
    expiredTrials: 0,
    notStarted: 0,
  };

  for (const driver of drivers) {
    switch (getAdminSubscriptionStatus(driver, now).kind) {
      case "active":
        summary.activeSubscriptions += 1;
        break;
      case "billing_issue":
        summary.billingIssues += 1;
        break;
      case "cancelled":
        summary.cancelled += 1;
        break;
      case "expired":
        summary.expiredSubscriptions += 1;
        break;
      case "trial":
        summary.activeTrials += 1;
        break;
      case "trial_expired":
        summary.expiredTrials += 1;
        break;
      case "not_started":
        summary.notStarted += 1;
        break;
    }
  }

  return summary;
}
