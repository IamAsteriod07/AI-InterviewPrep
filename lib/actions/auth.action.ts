"use server";

import "server-only";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

const ONE_WEEK = 60 * 60 * 24 * 7;

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    if (!db) {
      throw new Error("Firestore is not initialized");
    }

    if (!uid || typeof uid !== "string" || uid.trim() === "") {
      throw new Error("A valid uid must be provided to sign up");
    }

    if (!email || typeof email !== "string" || email.trim() === "") {
      throw new Error("A valid email must be provided to sign up");
    }

    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists) {
      return {
        success: false,
        message: "User already exists. Please sign in instead.",
      };
    }

    await db.collection("users").doc(uid).set({
      name,
      email,
    });

    return {
      success: true,
      message: "Account created successfully. Please Sign in.",
    };
  } catch (error: unknown) {
    console.error("Error creating a user", error);

    if (typeof error === "object" && error) {
      const { code, message } = error as { code?: string; message?: string };

      if (code === "auth/email-already-exists") {
        return {
          success: false,
          message: "This email is already in use.",
        };
      }

      if (message && message.includes("Project Id")) {
        return {
          success: false,
          message:
            "Firebase project ID is missing. Configure FIREBASE_PROJECT_ID or provide service account credentials.",
        };
      }
    }

    return {
      success: false,
      message: "Failed to create an account",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  if (!auth) {
    return {
      success: false,
      message:
        "Firebase Auth is not initialized. Configure FIREBASE_PROJECT_ID or provide service account credentials.",
    };
  }

  if (!email || typeof email !== "string" || email.trim() === "") {
    return {
      success: false,
      message: "A valid email must be provided to sign in.",
    };
  }

  if (!idToken || typeof idToken !== "string" || idToken.trim() === "") {
    return {
      success: false,
      message: "Missing ID token. Please try signing in again.",
    };
  }

  try {
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) {
      return {
        success: false,
        message: "User does not exist. Create an account instead.",
      };
    }

    await setSessionCookie(idToken);

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error) {
    console.error("Error signing in user", error);

    if (typeof error === "object" && error) {
      const { message } = error as { message?: string };

      if (message && message.includes("Project Id")) {
        return {
          success: false,
          message:
            "Firebase project ID is missing. Configure FIREBASE_PROJECT_ID or provide service account credentials.",
        };
      }
    }

    return {
      success: false,
      message: "Failed to log into an account",
    };
  }
}

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }

  const sessionCookie = await auth.createSessionCookie(idToken, {
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
    if (!auth || !db) {
      return null;
    }

    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    const userRecord = await db
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

