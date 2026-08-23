    const rows = await query<any[]>(
      `
      SELECT email
      FROM drivers
      WHERE localUserId = ?
      LIMIT 1
      `,
      [input.localUserId]
    );

    if (rows.length === 0) {
      return { success: false, error: "Driver account was not found." };
    }

    const email = rows[0].email;

    await query(
      `
      UPDATE drivers
      SET deletedAt = CURRENT_TIMESTAMP,
          status = 'deleted'
      WHERE localUserId = ?
      `,
      [input.localUserId]
    );

    // Remove any outstanding password reset tokens for this email
    await query(
      `
      DELETE FROM password_reset_tokens
      WHERE email = ?
        AND userType = 'driver'
      `,
      [email]
    );

    return { success: true };
  } catch (error) {
    console.error("[DriverAuth] Delete account failed:", error);
    return { success: false, error: "Unable to delete account." };
  }
}),
