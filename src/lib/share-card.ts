const CARD_FILENAME = "emberai-roast.png";

export function cardImageUrl(roastId: string): string {
  return `/api/og/${encodeURIComponent(roastId)}`;
}

export async function fetchCardFile(roastId: string): Promise<File> {
  const res = await fetch(cardImageUrl(roastId));
  if (!res.ok) throw new Error(`Card request failed: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], CARD_FILENAME, { type: "image/png" });
}

/** True when this browser can hand the card file to the native share sheet. */
export function canShareFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give iOS Safari a moment to start the download before the URL is revoked.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy path (insecure context, denied permission, older Safari).
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("Copy failed");
}
