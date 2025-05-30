import React, { useRef, useEffect } from "react";

// Note: a delay of null will still run the callback once more immediately!
export function useInterval(callback: () => void, delay: number | null) {
  const intervalRef = useRef<number | null>(null);
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    const tick = () => savedCallback.current();
    tick(); // Run the callback once immediately.
    if (typeof delay === "number") {
      intervalRef.current = window.setInterval(tick, delay);
      return () => {
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
        }
      };
    }
  }, [delay]);

  return intervalRef;
}
