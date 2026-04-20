import express from "express";
import path from "node:path";
import { eq } from "drizzle-orm";
import JWT from "jsonwebtoken";
import jose from "node-jose";
import { db } from "./db";
import { usersTable } from "./db/schema";
import {
  findApplicationByClientSecret,
  validateAuthorizationCode,
  createToken,
  markCodeUsed,
} from "./db/services";
import { PRIVATE_KEY, PUBLIC_KEY } from "./utils/cert";
import type { JWTClaims } from "./utils/user-token";
import crypto from 'node:crypto';

const app = express();
const PORT = process.env.PORT ?? 8000;

app.use(express.json());
app.use(express.static(path.resolve("public")));

app.get("/", (req, res) => res.json({ message: "Hello from Auth Server" }));

app.get("/health", (req, res) =>
  res.json({ message: "Server is healthy", healthy: true }),
);

app.get("/.well-known/openid-configuration", (req, res) => {
  const ISSUER = `http://localhost:${PORT}`;
  return res.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/o/authenticate`,
    userinfo_endpoint: `${ISSUER}/o/userinfo`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    token_endpoint:`${ISSUER}/o/tokeninfo`
  });
});

// GET /o/tokeninfo - Redirect to error page (POST only endpoint)
app.get('/o/tokeninfo', (req, res) => {
  const errorParams = new URLSearchParams({
    error: 'method_not_allowed',
    error_description: 'This endpoint only accepts POST requests',
    status: '405'
  });
  return res.redirect(`/error.html?${errorParams.toString()}`);
});

// POST /o/tokeninfo - Token exchange endpoint
app.post('/o/tokeninfo', async (req, res) => {
  try {
    const { code, client_secret } = req.body;

    // client secret se application fetch kro
    const application = await findApplicationByClientSecret(client_secret);
    if (!application) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client_secret'
      });
    }

    // code ko validate karo
    const authCodeRecord = await validateAuthorizationCode(code, application.id);
    if (!authCodeRecord) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid, expired, or already used authorization code'
      });
    }

    // code jiss user ka hai uska access token refresh token
    const userId = authCodeRecord.userId;

    // Secure random tokens generate karo (OAuth best practice)
    const access_token = crypto.randomBytes(32).toString('hex');
    const refresh_token = crypto.randomBytes(64).toString('hex');  // refresh token thoda lamba rakhte hain
    const expires_in = 3600;  // 1 hour (seconds mein) - aap apne hisaab se change kar sakte ho

    // tokens ko database mein save karo (future refresh aur validation ke liye)
    await createToken({
      access_token,
      refresh_token,
      user_id: userId,
      client_id: application.id,
      expires_at: new Date(Date.now() + expires_in * 1000),
      scope: authCodeRecord.scope || 'read write'   // agar scope tha toh save karo
    });

    // code ko used mark kar do (security - ek baar use ho gaya toh phir nahi chalega)
    await markCodeUsed(code);

    // final response (OAuth 2.0 standard format)
    res.json({
      access_token,
      token_type: 'Bearer',
      expires_in,
      refresh_token
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

app.get("/.well-known/jwks.json", async (_, res) => {
  const key = await jose.JWK.asKey(PUBLIC_KEY, "pem");
  return res.json({ keys: [key.toJSON()] });
});

app.get("/o/authenticate", (req, res) => {
  return res.sendFile(path.resolve("public", "authenticate.html"));
});

app.post("/o/authenticate/sign-in", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user || !user.password || !user.salt) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  const hash = crypto
    .createHash("sha256")
    .update(password + user.salt)
    .digest("hex");

  if (hash !== user.password) {
    res.status(401).json({ message: "Invalid email or password." });
    return;
  }

  const ISSUER = `http://localhost:${PORT}`;
  const now = Math.floor(Date.now() / 1000);

  const claims: JWTClaims = {
    iss: ISSUER,
    sub: user.id,
    email: user.email,
    email_verified: String(user.emailVerified),
    exp: now + 3600,
    given_name: user.firstName ?? "",
    family_name: user.lastName ?? undefined,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    picture: user.profileImageURL ?? undefined,
  };

  const token = JWT.sign(claims, PRIVATE_KEY, { algorithm: "RS256" });

  res.json({ token });
});

app.post("/o/authenticate/sign-up", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!email || !password || !firstName) {
    res
      .status(400)
      .json({ message: "First name, email, and password are required." });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    res
      .status(409)
      .json({ message: "An account with this email already exists." });
    return;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");

  await db.insert(usersTable).values({
    firstName,
    lastName: lastName ?? null,
    email,
    password: hash,
    salt,
  });

  res.status(201).json({ ok: true });
});

app.get("/o/userinfo", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ message: "Missing or invalid Authorization header." });
    return;
  }

  const token = authHeader.slice(7);

  let claims: JWTClaims;
  try {
    claims = JWT.verify(token, PUBLIC_KEY, {
      algorithms: ["RS256"],
    }) as JWTClaims;
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, claims.sub))
    .limit(1);

  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  res.json({
    sub: user.id,
    email: user.email,
    email_verified: user.emailVerified,
    given_name: user.firstName,
    family_name: user.lastName,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    picture: user.profileImageURL,
  });
});

app.listen(PORT, () => {
  console.log(`AuthServer is running on PORT ${PORT}`);
});
