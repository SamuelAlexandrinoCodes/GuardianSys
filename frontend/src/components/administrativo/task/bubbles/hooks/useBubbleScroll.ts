import { useRef, useCallback, useEffect } from "react";

const SCROLL_STEP = 24;
const SCROLL_MS = 50;

export function useBubbleScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const grabState = useRef({ isGrabbing: false, startX: 0, startScrollLeft: 0 });
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startScroll = useCallback((direction: "left" | "right") => {
    scrollIntervalRef.current = setInterval(() => {
      if (scrollRef.current) {
        const delta = direction === "left" ? -SCROLL_STEP : SCROLL_STEP;
        scrollRef.current.scrollLeft += delta;
      }
    }, SCROLL_MS);
  }, []);

  const stopScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopScroll(), [stopScroll]);

  const handleGrabStart = useCallback((e: React.MouseEvent) => {
    if (
      e.target instanceof Element &&
      (e.target.closest("[data-no-grab-scroll]") || e.target.closest("button"))
    )
      return;
    if (!scrollRef.current) return;
    grabState.current = {
      isGrabbing: true,
      startX: e.clientX,
      startScrollLeft: scrollRef.current.scrollLeft,
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const state = grabState.current;
      if (!state.isGrabbing || !scrollRef.current) return;
      scrollRef.current.scrollLeft = state.startScrollLeft - (ev.clientX - state.startX);
    };

    const onEnd = () => {
      grabState.current.isGrabbing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("mouseleave", onEnd);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("mouseleave", onEnd);
  }, []);

  return { scrollRef, startScroll, stopScroll, handleGrabStart };
}
