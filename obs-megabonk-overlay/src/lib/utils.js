import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Throttle function - limits how often a function can be called
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  let timeoutId = null;
  
  return function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;
    
    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      // Schedule a call for when the delay expires
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function - delays execution until after wait period of inactivity
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(fn, wait) {
  let timeoutId = null;
  
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, wait);
  };
}
