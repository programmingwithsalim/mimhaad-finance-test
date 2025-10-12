/**
 * Development-only logger
 * Prevents excessive logging in production
 */

const isDev = process.env.NODE_ENV === "development";

export const devLog = {
  info: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: any[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  debug: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
};

// Export for backward compatibility
export default devLog;
