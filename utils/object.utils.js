export const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

export const hasOwn = (source, key) =>
  Object.prototype.hasOwnProperty.call(source, key);

