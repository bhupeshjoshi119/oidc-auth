import { eq, and } from "drizzle-orm";
import { db } from "./index";
import {
  applicationsTable,
  authorizationCodesTable,
  tokensTable,
} from "./schema";

/**
 * Find an application by its client secret
 */
export async function findApplicationByClientSecret(clientSecret: string) {
  const application = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.clientSecret, clientSecret))
    .limit(1);

  return application[0] || null;
}

/**
 * Validate authorization code
 * Checks if code exists, belongs to the client, is not expired, and hasn't been used
 */
export async function validateAuthorizationCode(
  code: string,
  clientId: string
) {
  const now = new Date();

  const authCode = await db
    .select()
    .from(authorizationCodesTable)
    .where(
      and(
        eq(authorizationCodesTable.code, code),
        eq(authorizationCodesTable.clientId, clientId),
        eq(authorizationCodesTable.used, false) // Code must not be used yet
        // expiresAt > now (Drizzle doesn't support direct date comparison in where, so we filter in app)
      )
    )
    .limit(1);

  const authCodeRecord = authCode[0];

  // Check if code exists and hasn't expired
  if (!authCodeRecord || authCodeRecord.expiresAt < now) {
    return null;
  }

  return authCodeRecord;
}

/**
 * Mark authorization code as used (one-time use)
 */
export async function markCodeUsed(code: string) {
  await db
    .update(authorizationCodesTable)
    .set({ used: true })
    .where(eq(authorizationCodesTable.code, code));
}

/**
 * Create a new token record in the database
 */
export async function createToken(tokenData: {
  access_token: string;
  refresh_token: string;
  user_id: string;
  client_id: string;
  expires_at: Date;
  scope?: string;
}) {
  const result = await db
    .insert(tokensTable)
    .values({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      userId: tokenData.user_id,
      clientId: tokenData.client_id,
      expiresAt: tokenData.expires_at,
      scope: tokenData.scope || "",
    })
    .returning();

  return result[0];
}
