/**
 * Generates a unique ID without relying on crypto.getRandomValues,
 * which is unavailable in React Native without a native polyfill.
 */
let counter = 0;

export const generateId = (): string => {
  counter = (counter + 1) % 0xffff;
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    '-' +
    counter.toString(36)
  );
};
