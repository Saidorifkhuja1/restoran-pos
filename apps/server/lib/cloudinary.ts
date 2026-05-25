import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  format: string;
};

export async function uploadToCloudinary(file: File, folder: string): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  // If Cloudinary is not configured, save locally
  if (!cloudName || !uploadPreset) {
    return uploadLocally(file, folder);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Cloudinary upload xatosi: ${response.status} ${text}`);
  }

  return (await response.json()) as CloudinaryUploadResult;
}

async function uploadLocally(file: File, folder: string): Promise<CloudinaryUploadResult> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(uploadDir, { recursive: true });

  const ext = file.name.split(".").pop() || "jpg";
  const id = crypto.randomUUID();
  const fileName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return {
    secure_url: `/uploads/${folder}/${fileName}`,
    public_id: `${folder}/${id}`,
    resource_type: "image",
    bytes: buffer.length,
    format: ext,
  };
}
