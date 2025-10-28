import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

type FirebaseAdminServices = {
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getFirestore>;
};

declare global {
  // eslint-disable-next-line no-var
  var __FIREBASE_ADMIN__: FirebaseAdminServices | undefined;
}

const normalizePrivateKey = (value: string | undefined | null) => {
  if (!value) return null;

  const trimmed = value.trim();

  if (!trimmed.length) return null;

  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
};

const readServiceAccountFromFile = () => {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    join(process.cwd(), "firebase", "service-account.json"),
    join(process.cwd(), "service-account.json"),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      if (existsSync(filePath)) {
        const contents = readFileSync(filePath, "utf-8");
        if (contents.trim().length) {
          return contents;
        }
      }
    } catch (error) {
      console.warn(`Unable to read Firebase service account file at ${filePath}`, error);
    }
  }

  return null;
};

const decodeServiceAccount = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed.length) return null;

  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (error) {
    console.warn("Provided Firebase service account payload is not valid JSON or base64.");
    throw error;
  }
};

const normalizeServiceAccount = (
  payload: Record<string, unknown>
): ServiceAccountConfig | null => {
  const projectId =
    (payload.project_id as string | undefined) ??
    (payload.projectId as string | undefined) ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.GCLOUD_PROJECT ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const clientEmail =
    (payload.client_email as string | undefined) ??
    (payload.clientEmail as string | undefined) ??
    process.env.FIREBASE_CLIENT_EMAIL ??
    process.env.GOOGLE_CLIENT_EMAIL ??
    process.env.GCLOUD_CLIENT_EMAIL;

  const privateKey = normalizePrivateKey(
    (payload.private_key as string | undefined) ??
      (payload.privateKey as string | undefined) ??
      process.env.FIREBASE_PRIVATE_KEY
  );

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  return null;
};

const loadServiceAccount = (): ServiceAccountConfig | null => {
  const sources: Array<string | Record<string, unknown>> = [];

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    sources.push(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    sources.push(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const fileContents = readServiceAccountFromFile();
    if (fileContents) {
      sources.push(fileContents);
    }
  }

  for (const source of sources) {
    try {
      const payload =
        typeof source === "string" ? decodeServiceAccount(source) ?? {} : source;

      const normalized = normalizeServiceAccount(payload as Record<string, unknown>);

      if (normalized) {
        return normalized;
      }
    } catch (error) {
      console.warn("Unable to parse Firebase service account credentials.", error);
    }
  }

  return normalizeServiceAccount({}) ?? null;
};

const initFirebaseAdmin = (): FirebaseAdminServices | null => {
  if (globalThis.__FIREBASE_ADMIN__) {
    return globalThis.__FIREBASE_ADMIN__;
  }

  if (!getApps().length) {
    const serviceAccount = loadServiceAccount();
    const projectId = resolveProjectId(serviceAccount?.projectId);
    const usingEmulator = shouldUseEmulator();

    try {
      if (serviceAccount) {
        initializeApp({
          credential: cert({
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKey: serviceAccount.privateKey,
          }),
          projectId: serviceAccount.projectId,
        });
      } else {
          const adc = getApplicationDefaultCredential();

          if (adc) {
            initializeApp({
              credential: adc,
              projectId: usingEmulator ? projectId ?? "demo-project" : projectId ?? undefined,
            });
          } else if (usingEmulator) {
          initializeApp({
            projectId: projectId ?? "demo-project",
          });
        } else {
          throw new Error(
            "Firebase Admin credentials are missing. Provide FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_PATH, or the FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY trio."
          );
        }
      }
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK", error);
      return null;
    }
  }

  const services: FirebaseAdminServices = {
    auth: getAuth(),
    db: getFirestore(),
  };

  globalThis.__FIREBASE_ADMIN__ = services;

  return services;
};

const services = initFirebaseAdmin();

export const auth = services?.auth ?? null;
export const db = services?.db ?? null;

function resolveProjectId(fromServiceAccount?: string): string | null {
  const candidates = [
    fromServiceAccount,
    process.env.FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT,
    process.env.GOOGLE_CLOUD_PROJECT,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length) {
      return candidate.trim();
    }
  }

  return null;
}

function shouldUseEmulator(): boolean {
  return [
    process.env.FIRESTORE_EMULATOR_HOST,
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    process.env.FIREBASE_DATABASE_EMULATOR_HOST,
    process.env.FIREBASE_EMULATOR_HOST,
    process.env.PUBSUB_EMULATOR_HOST,
    process.env.STORAGE_EMULATOR_HOST,
    process.env.FIREBASE_EMULATOR_URL,
    process.env.USE_FIREBASE_EMULATOR,
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR,
  ].some((value) => typeof value === "string" && value.length > 0);
}

function getApplicationDefaultCredential() {
  try {
    return applicationDefault();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Application default credentials are not available.");
    }
    return null;
  }
}