/**
 * Enforcement View — read-only driver logbook display
 * for roadside inspections by NZ Transport Officers.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { ActivityGrid } from "@/components/activity-grid";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  formatHashShort,
  verifyFullChain,
  verifyLogIntegrity,
} from "@/lib/integrity";
import * as Logbook from "@/lib/logbook-storage";

type VerificationResult = {
  logId: string;
  verified: boolean;
  hash: string;
};

type ChainStatus = {
  valid: boolean;
  total: number;
  verified: number;
};

const COLORS = {
  navy: "#003366",
  navyLight: "#1A4D80",
  blueLight: "#7DD3FC",
  page: "#F4F7FC",
  white: "#FFFFFF",
  text: "#10243E",
  muted: "#6B7A99",
  subtle: "#9CA3AF",
  border: "#E2E8F0",
  blueSoft: "#F0F4FF",
  blueBorder: "#D0DCFF",
  green: "#276749",
  greenSoft: "#F0FFF4",
  greenBorder: "#C6F6D5",
  red: "#C53030",
  redSoft: "#FFF5F5",
  redBorder: "#FED7D7",
  warning: "#92400E",
  warningText: "#78350F",
  warningSoft: "#FFFBEB",
  warningBorder: "#FCD34D",
};

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

export default function EnforcementViewScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [logs, setLogs] = useState<Logbook.DailyLog[]>([]);
  const [verifications, setVerifications] = useState<
    Map<string, VerificationResult>
  >(new Map());
  const [chainStatus, setChainStatus] = useState<ChainStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const allLogs = await Logbook.getAllLogs(user.id);
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      const recentLogs = allLogs.filter((log) => {
        const startTime = new Date(log.startTime).getTime();

        return (
          !Number.isNaN(startTime) &&
          startTime >= twoWeeksAgo
        );
      });

      setLogs(recentLogs);

      const chain = await verifyFullChain(user.id, allLogs);

      setChainStatus({
        valid: chain.valid,
        total: chain.totalEntries,
        verified: chain.verifiedEntries,
      });

      const verificationMap = new Map<
        string,
        VerificationResult
      >();

      for (const log of recentLogs) {
        try {
          const result = await verifyLogIntegrity(log);

          verificationMap.set(log.id, {
            logId: log.id,
            verified: result.verified,
            hash: result.hash,
          });
        } catch (error) {
          console.error(
            `Failed to verify log ${log.id}:`,
            error
          );

          verificationMap.set(log.id, {
            logId: log.id,
            verified: false,
            hash: "N/A",
          });
        }
      }

      setVerifications(verificationMap);
    } catch (error) {
      console.error(
        "Failed to load enforcement view:",
        error
      );

      setLogs([]);
      setVerifications(new Map());
      setChainStatus({
        valid: false,
        total: 0,
        verified: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalDriving = logs.reduce(
    (sum, log) => sum + (log.totalDrivingSeconds ?? 0),
    0
  );

  const totalWork = logs.reduce(
    (sum, log) => sum + (log.totalWorkSeconds ?? 0),
    0
  );

  const totalBreaks = logs.reduce(
    (sum, log) =>
      sum +
      (log.breaks ?? []).reduce(
        (breakSum, breakEntry) =>
          breakSum + (breakEntry.durationSeconds ?? 0),
        0
      ),
    0
  );

  const integrityValid = chainStatus?.valid === true;
  const exceedsFortnightLimit = totalDriving > 70 * 3600;

  return (
    <ScreenContainer style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.75}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/history" as any);
              }
            }}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.readOnlyBadge}>
            <Text style={styles.readOnlyText}>
              🔒 READ ONLY
            </Text>
          </View>
        </View>

        <Text style={styles.headerTitle}>
          ENFORCEMENT VIEW
        </Text>

        <Text style={styles.headerSubtitle}>
          NZ TRANSPORT OFFICER INSPECTION
        </Text>
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color={COLORS.navy}
            />
            <Text style={styles.loadingText}>
              Verifying records...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.driverCard}>
              <Text style={styles.sectionTitle}>
                DRIVER DETAILS
              </Text>

              <DetailRow
                label="Name"
                value={user?.name ?? "—"}
              />
              <DetailRow
                label="Licence No."
                value={user?.licenceNumber ?? "—"}
              />
              <DetailRow
                label="Vehicle Rego"
                value={user?.vehicleRegistration ?? "—"}
              />
              <DetailRow
                label="Vehicle Type"
                value={user?.vehicleType ?? "—"}
                last
              />
            </View>

            <View
              style={[
                styles.integrityCard,
                integrityValid
                  ? styles.integrityCardValid
                  : styles.integrityCardInvalid,
              ]}
            >
              <View style={styles.integrityHeader}>
                <Text style={styles.integrityIcon}>
                  {integrityValid ? "✅" : "⚠️"}
                </Text>

                <Text
                  style={[
                    styles.integrityTitle,
                    integrityValid
                      ? styles.integrityTitleValid
                      : styles.integrityTitleInvalid,
                  ]}
                >
                  {integrityValid
                    ? "INTEGRITY VERIFIED"
                    : "INTEGRITY CHECK FAILED"}
                </Text>
              </View>

              <Text style={styles.integrityText}>
                Hash chain: {chainStatus?.verified ?? 0}/
                {chainStatus?.total ?? 0} records verified
                {integrityValid
                  ? " • No tampering detected"
                  : " • Records may have been modified"}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                FORTNIGHTLY SUMMARY
              </Text>

              <Text style={styles.sectionSubtitle}>
                Last 14 days
              </Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Logbook.formatHoursMinutes(
                      totalDriving
                    )}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    Driving
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Logbook.formatHoursMinutes(totalWork)}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    Work Time
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Logbook.formatHoursMinutes(
                      totalBreaks
                    )}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    Breaks
                  </Text>
                </View>
              </View>

              <View style={styles.summaryFooter}>
                <DetailRow
                  label="Fortnightly Driving Limit"
                  value={`${Logbook.formatHoursMinutes(
                    totalDriving
                  )} / 70h`}
                />

                <View style={styles.limitStatusRow}>
                  <Text style={styles.detailLabel}>
                    Limit Status
                  </Text>
                  <Text
                    style={[
                      styles.limitStatus,
                      exceedsFortnightLimit
                        ? styles.limitExceeded
                        : styles.limitCompliant,
                    ]}
                  >
                    {exceedsFortnightLimit
                      ? "Exceeded"
                      : "Within limit"}
                  </Text>
                </View>

                <DetailRow
                  label="Total Shifts"
                  value={String(logs.length)}
                  last
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                ACTIVITY GRID
              </Text>

              <Text style={styles.sectionSubtitle}>
                Cumulative work period
              </Text>

              <View style={styles.activityGridContainer}>
                <ActivityGrid logs={logs} compact />
              </View>
            </View>

            <Text style={styles.recordsTitle}>
              SHIFT RECORDS ({logs.length})
            </Text>

            {logs.map((log) => {
              const verification = verifications.get(log.id);

              const totalBreakSeconds = (
                log.breaks ?? []
              ).reduce(
                (sum, breakEntry) =>
                  sum +
                  (breakEntry.durationSeconds ?? 0),
                0
              );

              return (
                <View key={log.id} style={styles.shiftCard}>
                  <View style={styles.shiftHeader}>
                    <Text style={styles.shiftDate}>
                      {Logbook.formatDate(log.startTime)}
                    </Text>

                    <View
                      style={[
                        styles.verificationBadge,
                        verification?.verified
                          ? styles.verificationBadgeValid
                          : styles.verificationBadgeInvalid,
                      ]}
                    >
                      <Text
                        style={[
                          styles.verificationText,
                          verification?.verified
                            ? styles.verificationTextValid
                            : styles.verificationTextInvalid,
                        ]}
                      >
                        {verification?.verified
                          ? "✓ Verified"
                          : "○ Unverified"}
                      </Text>
                    </View>
                  </View>

                  <DetailRow
                    label="Shift"
                    value={`${Logbook.formatTime(
                      log.startTime
                    )} – ${Logbook.formatTime(
                      log.endTime
                    )}`}
                  />

                  <DetailRow
                    label="Driving"
                    value={Logbook.formatHoursMinutes(
                      log.totalDrivingSeconds ?? 0
                    )}
                  />

                  <DetailRow
                    label="Work Time"
                    value={Logbook.formatHoursMinutes(
                      log.totalWorkSeconds ?? 0
                    )}
                  />

                  <DetailRow
                    label="Breaks"
                    value={`${
                      (log.breaks ?? []).length
                    } (${Logbook.formatHoursMinutes(
                      totalBreakSeconds
                    )})`}
                    last
                  />

                  {log.restOverrideFlagged ? (
                    <View style={styles.overrideCard}>
                      <Text style={styles.overrideTitle}>
                        ⚠️ Rest requirement not met
                      </Text>

                      <Text style={styles.overrideSubtitle}>
                        Driver-reported unavoidable delay
                      </Text>

                      <Text style={styles.overrideNote}>
                        {log.restOverrideNote ||
                          "No explanation recorded."}
                      </Text>

                      <Text style={styles.overrideRule}>
                        Land Transport Rule: Work Time and
                        Logbooks 2007 — unavoidable delay
                        exception
                      </Text>
                    </View>
                  ) : null}

                  {verification?.hash &&
                  verification.hash !== "N/A" ? (
                    <View style={styles.hashContainer}>
                      <Text style={styles.hashText}>
                        SHA-256:{" "}
                        {formatHashShort(verification.hash)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>
                  No recent shift records
                </Text>
                <Text style={styles.emptyText}>
                  No shift records were found for the last
                  14 days.
                </Text>
              </View>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Generated by Drive Legal v1.0
              </Text>

              <Text style={styles.footerText}>
                Records protected by SHA-256 hash chain
              </Text>

              <Text style={styles.footerText}>
                Land Transport Rule: Work Time and Logbooks
                2007
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4A6AB0",
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  readOnlyBadge: {
    backgroundColor: COLORS.navyLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  readOnlyText: {
    color: COLORS.blueLight,
    fontSize: 11,
    fontWeight: "700",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: COLORS.blueLight,
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  driverCard: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
    marginBottom: 14,
  },
  detailRow: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EDF6",
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: "#4A5568",
    fontSize: 12,
    flex: 1,
    paddingRight: 12,
  },
  detailValue: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
  },
  integrityCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  integrityCardValid: {
    backgroundColor: COLORS.greenSoft,
    borderColor: COLORS.greenBorder,
  },
  integrityCardInvalid: {
    backgroundColor: COLORS.redSoft,
    borderColor: COLORS.redBorder,
  },
  integrityHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  integrityIcon: {
    fontSize: 19,
    marginRight: 8,
  },
  integrityTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  integrityTitleValid: {
    color: COLORS.green,
  },
  integrityTitleInvalid: {
    color: COLORS.red,
  },
  integrityText: {
    color: "#4A5568",
    fontSize: 12,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  summaryValue: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  summaryFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 5,
  },
  limitStatusRow: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EDF6",
  },
  limitStatus: {
    fontSize: 12,
    fontWeight: "800",
  },
  limitCompliant: {
    color: COLORS.green,
  },
  limitExceeded: {
    color: "#E53E3E",
  },
  activityGridContainer: {
    marginTop: 2,
  },
  recordsTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  shiftCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  shiftDate: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: "800",
  },
  verificationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  verificationBadgeValid: {
    backgroundColor: COLORS.greenSoft,
  },
  verificationBadgeInvalid: {
    backgroundColor: COLORS.warningSoft,
  },
  verificationText: {
    fontSize: 11,
    fontWeight: "800",
  },
  verificationTextValid: {
    color: COLORS.green,
  },
  verificationTextInvalid: {
    color: COLORS.warning,
  },
  overrideCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  overrideTitle: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: "800",
  },
  overrideSubtitle: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  overrideNote: {
    color: COLORS.warningText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  overrideRule: {
    color: "#B45309",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 7,
  },
  hashContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.blueSoft,
  },
  hashText: {
    color: COLORS.subtle,
    fontSize: 10,
    fontFamily: "Courier",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 42,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 38,
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 5,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  footer: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    color: COLORS.subtle,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 16,
  },
});
