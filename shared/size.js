// A size from my-herdr-text.json: used only if it is a positive number, else the default.
export const pickSize = (cfg, key, defaults) => (cfg?.[key] > 0 && Number.isFinite(cfg[key]) ? Number(cfg[key]) : defaults[key]);
