import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSwipeDownToCloseOptions {
  onClose: () => void;
  threshold?: number; // Minimum pixels dragged down to dismiss (default 75px)
  disabled?: boolean;
}

/**
 * High-performance, 120fps hardware-accelerated swipe-down-to-close gesture engine.
 * Directly animates GPU compositor layers (via rAF and translate3d) to eliminate React
 * re-render latency and deliver a silky iOS-grade native sheet feel.
 */
export function useSwipeDownToClose({
  onClose,
  threshold = 75,
  disabled = false,
}: UseSwipeDownToCloseOptions) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isPastThreshold, setIsPastThreshold] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const dragYRef = useRef(0);
  const rafIdRef = useRef<number>(0);
  const hasVibratedRef = useRef(false);
  const isClosingRef = useRef(false);

  // Velocity tracking buffer (rolling window of touch samples)
  const touchHistoryRef = useRef<{ y: number; time: number }[]>([]);

  // Apply smooth transform and backdrop opacity directly via rAF (120fps GPU compositing)
  const updateDOMTransform = useCallback((deltaY: number) => {
    dragYRef.current = deltaY;

    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        const y = dragYRef.current;
        if (sheetRef.current && !isClosingRef.current) {
          // Allow upward elastic rubber-band (up to -35px) and full downward translation
          sheetRef.current.style.transform = `translate3d(0, ${Math.max(-35, y)}px, 0)`;
          sheetRef.current.style.transition = 'none';
        }

        if (backdropRef.current && !isClosingRef.current) {
          backdropRef.current.style.transition = 'none';
          const progress = Math.min(Math.max(0, y) / 320, 1);
          backdropRef.current.style.opacity = `${Math.max(0.02, 1 - progress * 0.95)}`;
        }

        rafIdRef.current = 0;
      });
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || typeof window === 'undefined' || window.innerWidth >= 640) return;
      isClosingRef.current = false;
      const touchY = e.touches[0].clientY;
      startYRef.current = touchY;
      currentYRef.current = touchY;
      dragYRef.current = 0;
      hasVibratedRef.current = false;
      touchHistoryRef.current = [{ y: touchY, time: Date.now() }];

      setIsDragging(true);
      setIsPastThreshold(false);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || window.innerWidth >= 640) return;
      const touchY = e.touches[0].clientY;
      currentYRef.current = touchY;

      // Update rolling velocity history (keep max 4 samples)
      const now = Date.now();
      touchHistoryRef.current.push({ y: touchY, time: now });
      if (touchHistoryRef.current.length > 4) {
        touchHistoryRef.current.shift();
      }

      const rawDelta = touchY - startYRef.current;
      let dampedDelta = 0;

      if (rawDelta > 0) {
        // Natural silky downward motion
        dampedDelta = rawDelta;
      } else {
        // Elastic rubber-band resistance when pulling upward
        dampedDelta = -Math.pow(Math.abs(rawDelta), 0.7) * 1.5;
      }

      updateDOMTransform(dampedDelta);

      // Tactile threshold detection + subtle haptic feedback
      if (rawDelta >= threshold && !hasVibratedRef.current) {
        hasVibratedRef.current = true;
        setIsPastThreshold(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(8); // Ultra-light 8ms haptic tick
          } catch {}
        }
      } else if (rawDelta < threshold && hasVibratedRef.current) {
        hasVibratedRef.current = false;
        setIsPastThreshold(false);
      }
    },
    [disabled, threshold, updateDOMTransform]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || window.innerWidth >= 640) return;
    setIsDragging(false);
    setIsPastThreshold(false);

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }

    // Calculate release velocity from recent touch samples
    const history = touchHistoryRef.current;
    let velocity = 0;
    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const dt = newest.time - oldest.time;
      if (dt > 0) {
        velocity = (newest.y - oldest.y) / dt; // px per ms
      }
    }

    const currentDelta = dragYRef.current;
    // Dismiss if dragged past threshold OR swiped down with momentum (velocity > 0.42 px/ms)
    const shouldClose = currentDelta > threshold || (currentDelta > 30 && velocity > 0.42);

    if (shouldClose) {
      isClosingRef.current = true;
      const closeDistance = typeof window !== 'undefined' ? window.innerHeight : 650;
      const duration = velocity > 0.6 ? 220 : 310; // Dynamic duration based on momentum

      if (sheetRef.current) {
        sheetRef.current.style.transition = `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;
        sheetRef.current.style.transform = `translate3d(0, ${closeDistance}px, 0)`;
      }

      if (backdropRef.current) {
        backdropRef.current.style.transition = `opacity ${duration - 40}ms ease-out`;
        backdropRef.current.style.opacity = '0';
      }

      setTimeout(() => {
        onClose();
        isClosingRef.current = false;
        dragYRef.current = 0;
      }, duration);
    } else {
      // Elastic Apple spring snap-back to rest position (0px)
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.38s cubic-bezier(0.22, 1, 0.36, 1)';
        sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
      }

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.3s ease-out';
        backdropRef.current.style.opacity = '1';
      }

      dragYRef.current = 0;
    }
  }, [disabled, threshold, onClose]);

  // Programmatic smooth close (e.g. clicking 'X' or backdrop or apply button)
  const triggerCloseWithAnimation = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      isClosingRef.current = true;
      const closeDistance = typeof window !== 'undefined' ? window.innerHeight : 650;

      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
        sheetRef.current.style.transform = `translate3d(0, ${closeDistance}px, 0)`;
      }

      if (backdropRef.current) {
        backdropRef.current.style.transition = 'opacity 0.26s ease-out';
        backdropRef.current.style.opacity = '0';
      }

      setTimeout(() => {
        onClose();
        isClosingRef.current = false;
      }, 310);
    } else {
      onClose();
    }
  }, [onClose]);

  // Reset styles when sheet mounts / opens
  useEffect(() => {
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
      sheetRef.current.style.transition = '';
    }
    if (backdropRef.current) {
      backdropRef.current.style.opacity = '';
      backdropRef.current.style.backdropFilter = '';
    }
    dragYRef.current = 0;
    isClosingRef.current = false;
  }, []);

  const sheetStyle: React.CSSProperties = {
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  return {
    sheetRef,
    backdropRef,
    isDragging,
    isPastThreshold,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    triggerCloseWithAnimation,
    sheetStyle,
  };
}
