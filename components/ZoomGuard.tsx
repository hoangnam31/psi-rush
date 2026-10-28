"use client";

import { useEffect } from "react";

export function ZoomGuard() {
  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault();
    const preventMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventZoomWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const preventZoomKeys = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) event.preventDefault();
    };

    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("gestureend", prevent, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    document.addEventListener("wheel", preventZoomWheel, { passive: false });
    document.addEventListener("keydown", preventZoomKeys);

    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("gestureend", prevent);
      document.removeEventListener("touchmove", preventMultiTouch);
      document.removeEventListener("wheel", preventZoomWheel);
      document.removeEventListener("keydown", preventZoomKeys);
    };
  }, []);

  return null;
}
