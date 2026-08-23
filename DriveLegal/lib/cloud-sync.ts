export async function deleteDriverCloud(localUserId: string): Promise<{ success: boolean; error?: string }> {
  const result = await trpcCall("driverAuth.deleteAccount", { localUserId });
  if (!result) return { success: false, error: "Network error." };
  return result;
}
