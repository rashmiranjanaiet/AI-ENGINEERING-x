import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE_NAME = "airscope_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is missing. Add it to .env.local.");
  }

  return new TextEncoder().encode(secret);
}

export function getSessionCookieOptions() {
  const shouldUseSecureCookie =
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookie,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    if (
      typeof payload.id !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}
