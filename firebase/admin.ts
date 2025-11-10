import { createPrivateKey } from "node:crypto";
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

import { firebaseProjectId } from "./config";
import bundledServiceAccount from "./service-account.json";

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

  const stripWrappingQuotes = (input: string) => {
    const wrappers = ["'", '"', "`"];
    for (const quote of wrappers) {
      if (input.startsWith(quote) && input.endsWith(quote)) {
        return input.slice(1, -1);
      }
    }
    return input;
  };

  const ensureTrailingNewline = (input: string) =>
    input.endsWith("\n") ? input : `${input}\n`;

  const normalizeEscapes = (input: string) =>
    input
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\r\n?/g, "\n")
      .replace(/\\"/g, '"');

  const stripped = stripWrappingQuotes(value.trim());

  if (!stripped.length) {
    return null;
  }

  const normalized = normalizeEscapes(stripped).trim();

  if (!normalized.length) {
    return null;
  }

  if (normalized.startsWith("{") && normalized.endsWith("}")) {
    try {
      const parsed = JSON.parse(normalized) as Record<string, unknown>;
      const nestedKey =
        (parsed.private_key as string | undefined) ??
        (parsed.privateKey as string | undefined);

      if (typeof nestedKey === "string" && nestedKey.trim().length) {
        return normalizePrivateKey(nestedKey);
      }
    } catch (error) {
      console.warn(
        "Firebase private key payload is JSON but missing a private_key field.",
        error
      );
      return null;
    }
  }

  if (normalized.includes("-----BEGIN") && normalized.includes("-----END")) {
    const lines = normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const rebuilt = lines.join("\n");
    const pem = ensureTrailingNewline(rebuilt);

    if (!isParsablePrivateKey(pem)) {
      return null;
    }

    return pem;
  }

  const sanitizedBase64 = normalized.replace(/[^A-Za-z0-9+/=]/g, "");

  if (!sanitizedBase64.length) {
    return null;
  }

  let buffer: Buffer;

  try {
    buffer = Buffer.from(sanitizedBase64, "base64");
  } catch (error) {
    console.warn("Unable to decode Firebase service account private key.", error);
    return null;
  }

  if (!buffer.length) {
    return null;
  }

  if (buffer.length < 128) {
    console.warn(
      "Firebase service account private key appears truncated or invalid."
    );
    return null;
  }

  const base64Body = buffer.toString("base64");
  const chunked = base64Body.match(/.{1,64}/g)?.join("\n");

  if (!chunked) {
    return null;
  }

  const pem = `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----\n`;

  if (!isParsablePrivateKey(pem)) {
    return null;
  }

  return pem;
};

const extractPemBody = (pem: string) => {
  const match = pem.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----/);
  if (!match) {
    return null;
  }

  const [, , body] = match;
  const sanitized = body.replace(/\s+/g, "");

  return sanitized.length ? sanitized : null;
};

const isParsablePrivateKey = (pem: string) => {
  try {
    createPrivateKey({ key: pem, format: "pem" });
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err?.code === "ERR_OSSL_UNSUPPORTED") {
      const body = extractPemBody(pem);

      if (!body) {
        return false;
      }

      try {
        const decoded = Buffer.from(body, "base64");
        return decoded.length >= 128;
      } catch (decodeError) {
        console.warn("Firebase private key failed base64 validation.", decodeError);
        return false;
      }
    }

    console.warn("Firebase private key is not a valid PEM.", error);
    return false;
  }
};

const readServiceAccountFromFile = () => {
  const cwd = process.cwd();
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    join(cwd, "firebase", "service-account.json"),
    join(cwd, "service-account.json"),
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

  if (
    process.env.NODE_ENV !== "production" &&
    bundledServiceAccount &&
    typeof bundledServiceAccount === "object" &&
    Object.keys(bundledServiceAccount as Record<string, unknown>).length
  ) {
    sources.push(bundledServiceAccount as Record<string, unknown>);
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
    return null;
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
    firebaseProjectId,
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
  if (!hasApplicationDefaultCredentialSupport()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Application default credentials are not configured. Provide GOOGLE_APPLICATION_CREDENTIALS or a Firebase service account."
      );
    }
    return null;
  }

  try {
    return applicationDefault();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Application default credentials are not available.");
    }
    return null;
  }
}

function hasApplicationDefaultCredentialSupport(): boolean {
  const gcpRuntimeIndicators = [
    process.env.K_SERVICE,
    process.env.FUNCTION_TARGET,
    process.env.GAE_SERVICE,
    process.env.CLOUD_RUN_JOB,
    process.env.GCE_INSTANCE,
  ];

  const configuredCredentials = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    process.env.GOOGLE_AUTH_CREDENTIALS,
    process.env.GOOGLE_AUTH_CLIENT_EMAIL,
  ];

  return (
    gcpRuntimeIndicators.some((value) => typeof value === "string" && value.trim().length > 0) ||
    configuredCredentials.some((value) => typeof value === "string" && value.trim().length > 0)
  );
}