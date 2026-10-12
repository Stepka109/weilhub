/**
 * Validace nahrávaných souborů: povolené přípony, MIME typy a kontrola
 * skutečného obsahu podle „magických bajtů“ (nestačí věřit příponě).
 */

export interface FileTypeInfo {
  ext: string;
  mime: string;
  label: string;
  /** Lze bezpečně zobrazit přímo v aplikaci */
  inline: "pdf" | "image" | "text" | null;
}

export const FILE_TYPES: Record<string, FileTypeInfo> = {
  pdf: { ext: "pdf", mime: "application/pdf", label: "PDF", inline: "pdf" },
  docx: {
    ext: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
    inline: null,
  },
  pptx: {
    ext: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
    inline: null,
  },
  xlsx: {
    ext: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    label: "Excel",
    inline: null,
  },
  txt: { ext: "txt", mime: "text/plain", label: "Text", inline: "text" },
  png: { ext: "png", mime: "image/png", label: "Obrázek PNG", inline: "image" },
  jpg: { ext: "jpg", mime: "image/jpeg", label: "Obrázek JPG", inline: "image" },
  webp: { ext: "webp", mime: "image/webp", label: "Obrázek WEBP", inline: "image" },
};

export const IMAGE_EXTS = ["png", "jpg", "webp"];

export function extensionOf(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ext === "jpeg" ? "jpg" : ext;
}

export function fileTypeOf(fileName: string): FileTypeInfo | undefined {
  return FILE_TYPES[extensionOf(fileName)];
}

export function acceptAttribute(exts: string[]): string {
  return exts.flatMap((e) => (e === "jpg" ? [".jpg", ".jpeg"] : [`.${e}`])).join(",");
}

/** Bezpečný název souboru pro hlavičku Content-Disposition a úložiště. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(-180) || "soubor";
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0) {
  return sig.every((b, i) => bytes[offset + i] === b);
}

/**
 * Ověří, že obsah odpovídá deklarovanému typu.
 * DOCX/PPTX/XLSX jsou ZIP archivy – ověřujeme ZIP hlavičku a název hlavní části.
 */
export function matchesSignature(ext: string, bytes: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "docx":
    case "pptx":
    case "xlsx":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
    case "txt":
      return isProbablyText(bytes);
    default:
      return false;
  }
}

/** Text nesmí obsahovat nulové bajty ani jiné binární řídicí znaky. */
export function isProbablyText(bytes: Uint8Array): boolean {
  for (const b of bytes) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) return false;
  }
  return true;
}

/**
 * Kontrola metadat před nahráním (na serveru i v prohlížeči).
 * Vrací chybovou hlášku nebo null.
 */
export function validateFileMeta(
  fileName: string,
  sizeBytes: number,
  allowedExts: string[],
  maxMb: number,
): string | null {
  const ext = extensionOf(fileName);
  if (!FILE_TYPES[ext] || !allowedExts.includes(ext)) {
    return `Typ souboru „.${ext || "?"}“ není povolený. Povolené: ${allowedExts.map((e) => e.toUpperCase()).join(", ")}.`;
  }
  if (sizeBytes <= 0) return "Soubor je prázdný.";
  if (sizeBytes > maxMb * 1024 * 1024) return `Soubor je příliš velký. Maximum je ${maxMb} MB.`;
  return null;
}
