import { useEffect, useRef } from 'react';

/**
 * Custom hook for executing a callback at regular intervals.
 * @param {Function} callback - The function to execute.
 * @param {number} interval - The polling interval in milliseconds.
 */
export const usePolling = (callback, interval = 10000) => {
    const savedCallback = useRef();

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        const tick = () => {
            if (savedCallback.current) {
                savedCallback.current();
            }
        };

        if (interval !== null) {
            const id = setInterval(tick, interval);
            return () => clearInterval(id);
        }
    }, [interval]);
};
