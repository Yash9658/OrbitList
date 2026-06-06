import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

const uploadsRoot = path.resolve(process.cwd(), "server", "uploads");
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf"
]);

type UploadInput = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
};

type StoredUploadResult = {
  fileName: string;
  fileUrl: string;
  storageProvider: "local" | "supabase";
};

type ValidatedUpload = {
  buffer: Buffer;
  mimeType: string;
};

function normalizeMimeType(mimeType: string) {
  return mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase();
}

function detectMimeType(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }

  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }

  return null;
}

function sanitizeExtension(fileName: string, mimeType: string) {
  const extension = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();

  if (extension) {
    return extension;
  }

  if (mimeType === "image/png") {
    return ".png";
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  if (mimeType === "application/pdf") {
    return ".pdf";
  }

  return ".bin";
}

function assertAllowedFile(input: UploadInput) {
  const declaredMimeType = normalizeMimeType(input.mimeType);

  if (!allowedMimeTypes.has(declaredMimeType)) {
    throw new ApiError(400, "Only PNG, JPEG, WEBP, and PDF uploads are allowed");
  }

  const buffer = Buffer.from(input.contentBase64, "base64");

  if (!buffer.length) {
    throw new ApiError(400, "Uploaded file is empty");
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new ApiError(400, "Upload exceeds the 5 MB file limit");
  }

  const detectedMimeType = detectMimeType(buffer);

  if (!detectedMimeType) {
    throw new ApiError(400, "Uploaded file must be a real PNG, JPEG, WEBP, or PDF file");
  }

  if (declaredMimeType !== detectedMimeType) {
    throw new ApiError(
      400,
      `Uploaded file looks like ${detectedMimeType}, but the browser sent ${declaredMimeType}. Please choose the original file again.`
    );
  }

  return {
    buffer,
    mimeType: detectedMimeType
  };
}

function isSupabaseStorageConfigured() {
  return Boolean(
    env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.SUPABASE_STORAGE_BUCKET
  );
}

function buildStoredFileName(fileName: string, mimeType: string) {
  const extension = sanitizeExtension(fileName, mimeType);
  return `${Date.now()}-${randomUUID()}${extension}`;
}

function buildSupabaseObjectPath(storedFileName: string) {
  const folder = env.SUPABASE_STORAGE_FOLDER.replace(/^\/+|\/+$/g, "");
  return folder ? `${folder}/${storedFileName}` : storedFileName;
}

async function storeUploadLocally(
  storedFileName: string,
  buffer: Buffer,
  origin: string
): Promise<StoredUploadResult> {
  await mkdir(uploadsRoot, { recursive: true });

  const absolutePath = path.join(uploadsRoot, storedFileName);
  await writeFile(absolutePath, buffer);

  return {
    fileName: storedFileName,
    fileUrl: `${origin}/uploads/${storedFileName}`,
    storageProvider: "local"
  };
}

async function storeUploadInSupabase(
  storedFileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<StoredUploadResult> {
  const objectPath = buildSupabaseObjectPath(storedFileName);
  const encodedObjectPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const response = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/${env.SUPABASE_STORAGE_BUCKET}/${encodedObjectPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        "Content-Type": mimeType,
        "x-upsert": "false"
      },
      body: new Uint8Array(buffer)
    }
  );

  if (!response.ok) {
    const payload = await response.text();
    throw new ApiError(
      502,
      `Supabase storage upload failed: ${payload || response.statusText}`
    );
  }

  return {
    fileName: storedFileName,
    fileUrl: `${env.SUPABASE_URL}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${encodedObjectPath}`,
    storageProvider: "supabase"
  };
}

export async function storeUpload(
  input: UploadInput,
  origin: string
): Promise<StoredUploadResult> {
  const upload = assertAllowedFile(input);
  const storedFileName = buildStoredFileName(input.fileName, upload.mimeType);

  if (isSupabaseStorageConfigured()) {
    return storeUploadInSupabase(storedFileName, upload.buffer, upload.mimeType);
  }

  return storeUploadLocally(storedFileName, upload.buffer, origin);
}
