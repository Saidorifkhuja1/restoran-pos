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

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary sozlanmagan");
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
    throw new Error("Cloudinary upload xatosi");
  }

  return (await response.json()) as CloudinaryUploadResult;
}
