"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { canShareFile, copyText, downloadFile, fetchCardFile } from "@/lib/share-card";
import { roastShareUrl } from "@/lib/site";

type Props = {
  roastId: string;
  shareSlug: string;
  onClose: () => void;
};

const CLOSE_MS = 260;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * Post-onboarding share prompt. It renders on top of the roast page, so the
 * results are always already there behind it — "Skip for now" (or a swipe,
 * backdrop tap or Escape) simply removes the sheet.
 */
export function ShareSheet({ roastId, shareSlug, onClose }: Props) {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cardFailed, setCardFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showManualPrompt, setShowManualPrompt] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<File | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ startY: number; startT: number } | null>(null);

  const shareUrl = roastShareUrl(shareSlug);

  const close = useCallback(
    (reason: "skip" | "swipe" | "backdrop" | "escape") => {
      if (closeTimer.current !== undefined) return;
      posthog.capture("share_sheet_dismissed", { reason });
      setClosing(true);
      closeTimer.current = window.setTimeout(onClose, CLOSE_MS);
    },
    [onClose],
  );

  // Slide in, lock page scroll, move focus into the dialog.
  useEffect(() => {
    posthog.capture("share_sheet_shown");
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(closeTimer.current);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Build the PNG up front. navigator.share() must be called inside the tap's
  // user-activation window (Safari is strict about this), so the file has to be
  // ready before the button is pressed rather than fetched in the click handler.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchCardFile(roastId)
      .then((file) => {
        if (cancelled) return;
        fileRef.current = file;
        objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
      })
      .catch((err) => {
        console.error("[share-sheet] card fetch failed:", err);
        if (!cancelled) setCardFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [roastId]);

  async function ensureFile(): Promise<File | null> {
    if (fileRef.current) return fileRef.current;
    setBusy(true);
    try {
      fileRef.current = await fetchCardFile(roastId);
      return fileRef.current;
    } catch {
      setCardFailed(true);
      setStatus("Couldn't build your card. You can still copy the link.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onShareToInstagram() {
    setStatus(null);
    setShowManualPrompt(false);

    const file = await ensureFile();
    if (!file) return;

    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file] });
        posthog.capture("roast_shared", { source: "share_sheet", method: "native_share" });
        return;
      } catch (err) {
        // Closing the native sheet isn't a failure.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else (NotAllowedError, no target app, ...) drops to the manual path.
      }
    }

    // No native file sharing (most desktop browsers, older Safari/Chrome): save + instruct.
    downloadFile(file);
    setShowManualPrompt(true);
    posthog.capture("roast_shared", { source: "share_sheet", method: "manual_save" });
  }

  async function onCopyLink() {
    setShowManualPrompt(false);
    try {
      await copyText(shareUrl);
      setStatus("Link copied ✓");
      posthog.capture("roast_shared", { source: "share_sheet", method: "copy_link" });
    } catch {
      setStatus(`Couldn't copy automatically. Your link: ${shareUrl}`);
    }
  }

  async function onSaveImage() {
    setShowManualPrompt(false);
    const file = await ensureFile();
    if (!file) return;
    downloadFile(file);
    setStatus("Image saved ✓");
    posthog.capture("roast_shared", { source: "share_sheet", method: "save_image" });
  }

  // Swipe-down-to-dismiss, driven from the handle/header area only so the
  // scrollable body underneath keeps its normal touch scrolling.
  function onDragStart(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = { startY: e.clientY, startT: e.timeStamp };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setDragY(Math.max(0, e.clientY - drag.current.startY));
  }
  function onDragEnd(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    const velocity = dy / Math.max(1, e.timeStamp - drag.current.startT);
    drag.current = null;
    setDragging(false);
    if (dy > DISMISS_DISTANCE || (dy > 30 && velocity > DISMISS_VELOCITY)) {
      close("swipe");
    } else {
      setDragY(0);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close("escape");
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheetRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const open = entered && !closing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-sheet-title"
      onKeyDown={onKeyDown}
    >
      <div
        className={`absolute inset-0 bg-black/75 transition-opacity duration-300 motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => close("backdrop")}
        aria-hidden
      />

      <div
        ref={sheetRef}
        tabIndex={-1}
        className="relative w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[36px] bg-[#111111] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none motion-reduce:transition-none"
        style={{
          maxHeight: "94dvh",
          transform: `translateY(${open ? `${dragY}px` : "100%"})`,
          transition: dragging ? "none" : `transform ${CLOSE_MS + 60}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
        }}
      >
        {/* Drag handle + headline: the swipe-to-dismiss zone */}
        <div
          className="cursor-grab touch-none select-none pt-3 active:cursor-grabbing"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[#333333]" aria-hidden />
          <h2
            id="share-sheet-title"
            className="text-center text-3xl font-black tracking-tight text-[#f5f3f0]"
          >
            This is embarrassing.
          </h2>
          <p className="mt-1 text-center text-base text-[#98979c]">
            Show it off before you fix it.
          </p>
        </div>

        {/* Card preview (shrinks on short viewports so the buttons stay reachable) */}
        <div
          className="relative mx-auto mt-5 max-w-full overflow-hidden rounded-[24px] border border-[#262626] bg-[#0a0a0b]"
          style={{ height: "clamp(300px, calc(100dvh - 470px), 605px)", aspectRatio: "9 / 16" }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob: URL from the generated card
            <img src={previewUrl} alt="Your Ember roast card" className="h-full w-full object-cover" />
          ) : cardFailed ? (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-[#98979c]">
              Couldn&apos;t generate your card preview.
            </p>
          ) : (
            <div className="h-full w-full animate-pulse bg-[#1A1A1A]" aria-label="Generating your card" />
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy || cardFailed}
            onClick={() => void onShareToInstagram()}
            className="w-full rounded-2xl bg-[#FF3D00] px-6 py-4 text-lg font-bold text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Preparing…" : "Share to Instagram Story"}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void onCopyLink()}
              className="rounded-2xl border border-[#333333] bg-[#1A1A1A] px-4 py-3.5 text-base font-semibold text-white transition hover:border-[#4a4a4a] active:scale-[0.99]"
            >
              Copy Link
            </button>
            <button
              type="button"
              disabled={busy || cardFailed}
              onClick={() => void onSaveImage()}
              className="rounded-2xl border border-[#333333] bg-[#1A1A1A] px-4 py-3.5 text-base font-semibold text-white transition hover:border-[#4a4a4a] active:scale-[0.99] disabled:opacity-50"
            >
              Save Image
            </button>
          </div>
        </div>

        <div aria-live="polite" className="mt-3 empty:hidden">
          {showManualPrompt ? (
            <p className="rounded-2xl border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-center text-sm leading-relaxed text-[#d4d4d8]">
              Image saved to your device. Open Instagram, start a Story, and pick it from your photos
              or downloads. 📸
            </p>
          ) : status ? (
            <p className="break-all text-center text-sm text-[#98979c]">{status}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => close("skip")}
          className="mx-auto mt-2 block px-4 py-3 text-sm text-[#6b6b70] transition hover:text-[#98979c]"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
