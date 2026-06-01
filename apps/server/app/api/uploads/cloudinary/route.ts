import { NextRequest } from "next/server";
import { z } from "zod";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { badRequest, serverError, success, unauthorized } from "@/lib/responses";
import { getAuthContext } from "@/lib/responses";
import { zodMessage } from "@/lib/route-helpers";

const uploadSchema = z.object({
  folder: z.enum(["logos", "menu-items"]).default("menu-items"),
});
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.isAuthenticated) return unauthorized("Kirish uchun login qiling");

    const formData = await request.formData();
    const file = formData.get("file");
    const parsed = uploadSchema.safeParse({ folder: formData.get("folder") || "menu-items" });
    if (!parsed.success) return badRequest(zodMessage(parsed.error));
    if (!(file instanceof File)) return badRequest("Fayl majburiy");
    if (file.size > 5 * 1024 * 1024) return badRequest("Fayl 5MB dan oshmasin");
    if (!allowedTypes.has(file.type)) return badRequest("Faqat JPG, PNG, WEBP yoki GIF rasm yuklash mumkin");

    const result = await uploadToCloudinary(file, `restopos/${parsed.data.folder}`);
    return success({
      url: result.secure_url,
      publicId: result.public_id,
      type: result.resource_type,
      bytes: result.bytes,
      format: result.format,
    }, 201);
  } catch (error) {
    console.error("[Cloudinary Upload Error]", error);
    return serverError(error instanceof Error ? error.message : "Fayl yuklashda xato");
  }
}
