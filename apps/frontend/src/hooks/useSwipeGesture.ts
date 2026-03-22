import { useRef, useCallback } from 'react';

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
}

/**
 * useSwipeGesture Hook
 * 
 * Detects horizontal swipe gestures on touch devices
 * 
 * Usage:
 *   const swipeHandlers = useSwipeGesture({
 *     onSwipeLeft: () => console.log('Swiped left'),
 *     onSwipeRight: () => console.log('Swiped right'),
 *     minSwipeDistance: 50
 *   });
 * 
 *   <div {...swipeHandlers}>Swipeable content</div>
 */
export const useSwipeGesture = ({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
}: UseSwipeGestureOptions): SwipeHandlers => {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaX = touchStartX.current - touchEndX.current;
    const deltaY = touchStartY.current - touchEndY.current;
    
    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Swipe left
      if (deltaX > minSwipeDistance && onSwipeLeft) {
        onSwipeLeft();
      }
      
      // Swipe right
      if (deltaX < -minSwipeDistance && onSwipeRight) {
        onSwipeRight();
      }
    }
    
    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    touchEndY.current = 0;
  }, [minSwipeDistance, onSwipeLeft, onSwipeRight]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};
