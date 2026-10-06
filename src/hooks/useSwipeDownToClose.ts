import { useState, useRef, useCallback } from 'react';

interface UseSwipeDownToCloseOptions {
  onClose: () => void;
  threshold?: number; // Minimum pixels dragged down to dismiss (default 75px)
  disabled?: boolean;
}

export function useSwipeDownToClose({
  onClose,
  threshold = 75,
  disabled = false,
}: UseSwipeDownToCloseOptions) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || typeof window === 'undefined' || window.innerWidth >= 640) return;
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      startTimeRef.current = Date.now();
      setIsDragging(true);
      setDragY(0);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || disabled || window.innerWidth >= 640) return;
      currentYRef.current = e.touches[0].clientY;
      const deltaY = currentYRef.current - startYRef.current;
      // Only permit downward motion with gentle resistance
      if (deltaY > 0) {
        setDragY(deltaY);
      } else {
        setDragY(0);
      }
    },
    [isDragging, disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled || window.innerWidth >= 640) return;
    setIsDragging(false);

    const deltaY = currentYRef.current - startYRef.current;
    const elapsedTime = Date.now() - startTimeRef.current;
    const velocity = deltaY / Math.max(elapsedTime, 1); // px per ms

    // Dismiss if pulled past threshold (>75px) or quickly swiped downward (velocity > 0.45px/ms)
    if (deltaY > threshold || (deltaY > 35 && velocity > 0.45)) {
      setIsClosing(true);
      const closeDistance = typeof window !== 'undefined' ? window.innerHeight : 600;
      setDragY(closeDistance);
      setTimeout(() => {
        onClose();
        setIsClosing(false);
        setDragY(0);
      }, 260);
    } else {
      // Elastic spring back to top
      setDragY(0);
    }
  }, [isDragging, disabled, threshold, onClose]);

  const triggerCloseWithAnimation = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setIsClosing(true);
      const closeDistance = typeof window !== 'undefined' ? window.innerHeight : 600;
      setDragY(closeDistance);
      setTimeout(() => {
        onClose();
        setIsClosing(false);
        setDragY(0);
      }, 260);
    } else {
      onClose();
    }
  }, [onClose]);

  // CSS Styles applied to sheet container
  const sheetStyle: React.CSSProperties = {
    transform:
      isClosing || dragY > 0
        ? `translateY(${dragY}px)`
        : undefined,
    transition: isDragging
      ? 'none'
      : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
    touchAction: 'pan-x',
  };

  // Dynamic backdrop opacity calculation (fades proportionately as sheet is pulled down)
  const backdropOpacity = Math.max(0.1, 1 - Math.min(dragY / 320, 0.9));

  return {
    dragY,
    isDragging,
    isClosing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    triggerCloseWithAnimation,
    sheetStyle,
    backdropOpacity,
  };
}
