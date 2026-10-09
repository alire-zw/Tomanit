export async function compressSupportImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("فقط تصویر مجاز است");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("حجم تصویر زیاد است");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("خواندن تصویر ناموفق بود"));
      el.src = objectUrl;
    });

    const maxSide = 1280;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("فشرده‌سازی تصویر ناموفق بود");
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isImageOnlyMessageBody(body: string, hasImage: boolean): boolean {
  if (!hasImage) return false;
  const trimmed = body.trim();
  return !trimmed || trimmed === "📷 تصویر" || trimmed === "تصویر";
}
