const normalizeString = (value) => String(value || "").trim();

export const assertRequiredString = (payload, key, label = key) => {
  const value = normalizeString(payload?.[key]);
  if (!value) {
    const error = new Error(`${label} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};

export const assertPositiveNumber = (value, label) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    const error = new Error(`${label} must be greater than zero`);
    error.statusCode = 400;
    throw error;
  }
  return numberValue;
};

export const assertArray = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) {
    const error = new Error(`${label} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value;
};
