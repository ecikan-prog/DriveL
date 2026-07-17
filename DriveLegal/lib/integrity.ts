/**
 * Data Integrity & Tamper-Proofing Module for Drive Legal.
 * 
 * Implements a SHA-256 hash chain on completed shift logs.
 * Each log entry includes a hash of its own data + the previous entry's hash,
 * creating a tamper-evident chain. If any record is modified, all subsequent
 * hashes become invalid, making tampering detectable.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyLog } from "./logbook-storage";

const HASH_CHAIN_KEY = "drivelegal_hash_chain";

export type VerifiedLog = DailyLog & {
  hash: string;
  previousHash: string;
  verified: boolean;
};

export type HashChainEntry = {
  logId: string;
  hash: string;
  previousHash: string;
  timestamp: string;
};

/**
 * Simple SHA-256 implementation using Web Crypto API (available in React Native).
 * Falls back to a deterministic hash for environments without crypto.
 */
async function sha256(message: string): Promise<string> {
  try {
    // Use SubtleCrypto if available (modern RN + web)
    if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // Fallback below
  }

  // Deterministic fallback hash (not cryptographically secure but functional)
  // This ensures the app works on all platforms while maintaining chain integrity
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  // Extend to 64-char hex-like string for consistency
  const base = Math.abs(hash).toString(16).padStart(8, "0");
  let result = "";
  for (let i = 0; i < 8; i++) {
    const segment = Math.abs(hash * (i + 1) * 31).toString(16).padStart(8, "0");
    result += segment;
  }
  return result.slice(0, 64);
}

/**
 * Generate a canonical string representation of a DailyLog for hashing.
 * This ensures consistent hash computation regardless of property order.
 */
function canonicalizeLog(log: DailyLog): string {
  return JSON.stringify({
    id: log.id,
    userId: log.userId,
    date: log.date,
    startTime: log.startTime,
    endTime: log.endTime,
    totalDrivingSeconds: log.totalDrivingSeconds,
    totalWorkSeconds: log.totalWorkSeconds,
    breaks: (log.breaks ?? []).map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      durationSeconds: b.durationSeconds,
    })),
    events: (log.events ?? []).map((e) => ({
      type: e.type,
      timestamp: e.timestamp,
    })),
  });
}

/**
 * Compute the hash for a log entry given the previous hash in the chain.
 */
export async function computeLogHash(log: DailyLog, previousHash: string): Promise<string> {
  const canonical = canonicalizeLog(log);
  const payload = `${previousHash}|${canonical}`;
  return sha256(payload);
}

/**
 * Get the hash chain from storage.
 */
async function getHashChain(userId: string): Promise<HashChainEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(`${HASH_CHAIN_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save the hash chain to storage.
 */
async function saveHashChain(userId: string, chain: HashChainEntry[]): Promise<void> {
  await AsyncStorage.setItem(`${HASH_CHAIN_KEY}_${userId}`, JSON.stringify(chain));
}

/**
 * Add a new log to the hash chain. Called when a shift is ended.
 * Returns the hash for the new entry.
 */
export async function addToHashChain(log: DailyLog): Promise<string> {
  const chain = await getHashChain(log.userId);
  const previousHash = chain.length > 0 ? chain[chain.length - 1].hash : "GENESIS_BLOCK_DRIVELEGAL_V1";
  const hash = await computeLogHash(log, previousHash);

  chain.push({
    logId: log.id,
    hash,
    previousHash,
    timestamp: new Date().toISOString(),
  });

  await saveHashChain(log.userId, chain);
  return hash;
}

/**
 * Verify the integrity of a single log entry against the hash chain.
 */
export async function verifyLogIntegrity(log: DailyLog): Promise<{ verified: boolean; hash: string; previousHash: string }> {
  const chain = await getHashChain(log.userId);
  const entry = chain.find((e) => e.logId === log.id);

  if (!entry) {
    // Log was created before hash chain was implemented — mark as unverified but not tampered
    return { verified: false, hash: "N/A", previousHash: "N/A" };
  }

  // Recompute the hash and compare
  const recomputedHash = await computeLogHash(log, entry.previousHash);
  const verified = recomputedHash === entry.hash;

  return { verified, hash: entry.hash, previousHash: entry.previousHash };
}

/**
 * Verify the entire hash chain for a user. Returns verification results.
 */
export async function verifyFullChain(userId: string, logs: DailyLog[]): Promise<{
  valid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt?: string;
}> {
  const chain = await getHashChain(userId);

  if (chain.length === 0) {
    return { valid: true, totalEntries: 0, verifiedEntries: 0 };
  }

  let verifiedCount = 0;
  let previousHash = "GENESIS_BLOCK_DRIVELEGAL_V1";

  for (const entry of chain) {
    const log = logs.find((l) => l.id === entry.logId);
    if (!log) {
      return {
        valid: false,
        totalEntries: chain.length,
        verifiedEntries: verifiedCount,
        brokenAt: entry.logId,
      };
    }

    const recomputedHash = await computeLogHash(log, previousHash);
    if (recomputedHash !== entry.hash) {
      return {
        valid: false,
        totalEntries: chain.length,
        verifiedEntries: verifiedCount,
        brokenAt: entry.logId,
      };
    }

    // Also verify chain linkage
    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        totalEntries: chain.length,
        verifiedEntries: verifiedCount,
        brokenAt: entry.logId,
      };
    }

    previousHash = entry.hash;
    verifiedCount++;
  }

  return {
    valid: true,
    totalEntries: chain.length,
    verifiedEntries: verifiedCount,
  };
}

/**
 * Get the hash for a specific log ID.
 */
export async function getLogHash(userId: string, logId: string): Promise<string | null> {
  const chain = await getHashChain(userId);
  const entry = chain.find((e) => e.logId === logId);
  return entry?.hash ?? null;
}

/**
 * Format a hash for display (truncated for UI).
 */
export function formatHashShort(hash: string): string {
  if (!hash || hash === "N/A") return "—";
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}
