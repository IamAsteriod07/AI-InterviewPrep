"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

const ONE_WEEK = 60 * 60 * 24 * 7;

function ensureAuth(): NonNullable<typeof auth> {
  if (!auth) {
    throw new Error("Firebase Auth instance is not initialized.");
  }

  return auth;
}

function ensureDb(): NonNullable<typeof db> {
  if (!db) {
    throw new Error("Firestore instance is not initialized.");
  }

  return db;
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    const firestore = ensureDb();
    const userRecord = await firestore.collection("users").doc(uid).get();
    if (userRecord.exists) {
      return {
        success: false,
        message: "User already exists. Please sign in instead.",
      };
    }

    await firestore.collection("users").doc(uid).set({
      name,
      email,
    });

    return {
      success: true,
      message: "Account created successfully. Please Sign in.",
    };
  } catch (e: any) {
    console.error("Error creating a user", e);

    if (e.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use.",
      };
    }
    return {
      success: false,
      message: "Failed to create an account",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    const adminAuth = ensureAuth();
    const userRecord = await adminAuth.getUserByEmail(email);
    if (!userRecord) {
      return {
        success: false,
        message: "User does not exist. Create an account instead.",
      };
    }

    await setSessionCookie(idToken);
  } catch (e) {
    console.log(e);
  }

  return {
    success: false,
    message: "Failed to log into an account",
  };
}

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  const adminAuth = ensureAuth();

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: ONE_WEEK * 1000, // 7 days
  });

  cookieStore.set("session", sessionCookie, {
    maxAge: ONE_WEEK,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) return null;
  try {
    const adminAuth = ensureAuth();
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

    const firestore = ensureDb();
    const userRecord = await firestore
      .collection("users")
      .doc(decodedClaims.uid)
      .get();

    if (!userRecord.exists) return null;

    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (e) {
    console.log(e);

    return null;
  }
}

export async function isAuthenticated() {
  const user = await getCurrentUser();

  return !!user;
}



