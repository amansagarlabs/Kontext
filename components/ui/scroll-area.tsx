"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both";
  maxHeight?: string;
  maxWidth?: string;
  scrollbar?: boolean;
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = "vertical", maxHeight, maxWidth, scrollbar = true, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [showVertical, setShowVertical] = React.useState(false);
    const [showHorizontal, setShowHorizontal] = React.useState(false);
    const [thumbY, setThumbY] = React.useState({ top: 0, height: 0 });
    const [thumbX, setThumbX] = React.useState({ left: 0, width: 0 });
    const [isDragging, setIsDragging] = React.useState<"y" | "x" | null>(null);
    const dragStart = React.useRef({ y: 0, x: 0, scrollTop: 0, scrollLeft: 0 });

    const checkScroll = React.useCallback(() => {
      const el = scrollRef.current;
      if (!el) return;
      setShowVertical(el.scrollHeight > el.clientHeight);
      setShowHorizontal(el.scrollWidth > el.clientWidth);

      // Update thumb position
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      const scrollWidth = el.scrollWidth - el.clientWidth;
      if (scrollHeight > 0) {
        const ratio = el.clientHeight / el.scrollHeight;
        setThumbY({
          top: (scrollTop / scrollHeight) * (el.clientHeight - Math.max(el.clientHeight * ratio, 30)),
          height: Math.max(el.clientHeight * ratio, 30),
        });
      }
      if (scrollWidth > 0) {
        const ratio = el.clientWidth / el.scrollWidth;
        setThumbX({
          left: (scrollTop === undefined ? 0 : el.scrollLeft / scrollWidth) * (el.clientWidth - Math.max(el.clientWidth * ratio, 30)),
          width: Math.max(el.clientWidth * ratio, 30),
        });
      }
    }, []);

    React.useEffect(() => {
      const el = scrollRef.current;
      if (!el) return;
      checkScroll();
      el.addEventListener("scroll", checkScroll, { passive: true });
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        ro.disconnect();
      };
    }, [checkScroll]);

    const handleMouseDown = React.useCallback((axis: "y" | "x", e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(axis);
      const el = scrollRef.current;
      if (!el) return;
      dragStart.current = {
        y: e.clientY,
        x: e.clientX,
        scrollTop: el.scrollTop,
        scrollLeft: el.scrollLeft,
      };
    }, []);

    React.useEffect(() => {
      if (!isDragging) return;
      const el = scrollRef.current;
      if (!el) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging === "y") {
          const delta = e.clientY - dragStart.current.y;
          const scrollHeight = el.scrollHeight - el.clientHeight;
          const trackHeight = el.clientHeight - thumbY.height;
          if (trackHeight > 0) {
            el.scrollTop = dragStart.current.scrollTop + (delta / trackHeight) * scrollHeight;
          }
        } else {
          const delta = e.clientX - dragStart.current.x;
          const scrollWidth = el.scrollWidth - el.clientWidth;
          const trackWidth = el.clientWidth - thumbX.width;
          if (trackWidth > 0) {
            el.scrollLeft = dragStart.current.scrollLeft + (delta / trackWidth) * scrollWidth;
          }
        }
      };
      const handleMouseUp = () => setIsDragging(null);

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }, [isDragging, thumbY.height, thumbX.width]);

    return (
      <div
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        style={{ maxHeight, maxWidth }}
        {...props}
      >
        <div
          ref={scrollRef}
          className="h-full w-full overflow-auto"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          <style>{`.scroll-area::-webkit-scrollbar { display: none; }`}</style>
          <div className="scroll-area">{children}</div>
        </div>

        {/* Vertical scrollbar */}
        {scrollbar && showVertical && orientation !== "horizontal" && (
          <div className="absolute right-1 top-0 bottom-0 w-2">
            <div className="relative h-full rounded-full bg-black/5 dark:bg-white/5">
              <div
                className="absolute rounded-full bg-black/20 transition-colors hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/30 cursor-grab active:cursor-grabbing"
                style={{
                  top: thumbY.top,
                  height: thumbY.height,
                  width: 8,
                  left: 0,
                }}
                onMouseDown={(e) => handleMouseDown("y", e)}
              />
            </div>
          </div>
        )}

        {/* Horizontal scrollbar */}
        {scrollbar && showHorizontal && orientation !== "vertical" && (
          <div className="absolute bottom-1 left-0 right-0 h-2">
            <div className="relative w-full rounded-full bg-black/5 dark:bg-white/5">
              <div
                className="absolute rounded-full bg-black/20 transition-colors hover:bg-black/30 dark:bg-white/20 dark:hover:bg-white/30 cursor-grab active:cursor-grabbing"
                style={{
                  left: thumbX.left,
                  width: thumbX.width,
                  height: 8,
                  top: 0,
                }}
                onMouseDown={(e) => handleMouseDown("x", e)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
export type { ScrollAreaProps };
