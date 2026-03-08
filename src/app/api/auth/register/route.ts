import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = registerSchema.safeParse(payload);

    if (!result.success) {
      return NextResponse.json(
        { error: "Enter a valid name, email, and password." },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const email = result.data.email.toLowerCase();
    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(result.data.password, 12);
    const createdUser = await User.create({
      name: result.data.name,
      email,
      passwordHash,
    });

    const sessionUser = {
      id: createdUser._id.toString(),
      name: createdUser.name,
      email: createdUser.email,
    };

    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({ user: sessionUser });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions(),
    );

    return response;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create your account right now." },
      { status: 500 },
    );
  }
}
