import { supabase } from "../../config/supabase.js";

// In-memory cache for settings
const settingsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastCacheUpdateTime = 0;

/**
 * Get a single setting value
 * @param {string} settingKey - The key of the setting to retrieve
 * @param {any} defaultValue - Default value if setting not found
 * @returns {Promise<any>} The setting value
 */
export const getSetting = async (settingKey, defaultValue = null) => {
  try {
    // Check if cache is still valid
    if (Date.now() - lastCacheUpdateTime < CACHE_TTL_MS && settingsCache.has(settingKey)) {
      return settingsCache.get(settingKey);
    }

    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value, setting_type")
      .eq("setting_key", settingKey)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error(`Failed to fetch setting ${settingKey}:`, error);
      return defaultValue;
    }

    if (!data) {
      return defaultValue;
    }

    // Parse value based on type
    const value = parseSettingValue(data.setting_value, data.setting_type);
    settingsCache.set(settingKey, value);
    return value;
  } catch (error) {
    console.error(`Error getting setting ${settingKey}:`, error);
    return defaultValue;
  }
};

/**
 * Get multiple settings at once
 * @param {string[]} settingKeys - Array of setting keys
 * @returns {Promise<Object>} Object with setting keys and values
 */
export const getSettings = async (settingKeys = []) => {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value, setting_type")
      .in("setting_key", settingKeys);

    if (error) {
      console.error("Failed to fetch settings:", error);
      return {};
    }

    const result = {};
    (data || []).forEach((row) => {
      const value = parseSettingValue(row.setting_value, row.setting_type);
      result[row.setting_key] = value;
      settingsCache.set(row.setting_key, value);
    });

    lastCacheUpdateTime = Date.now();
    return result;
  } catch (error) {
    console.error("Error getting settings:", error);
    return {};
  }
};

/**
 * Get all settings
 * @returns {Promise<Object>} Object with all setting keys and values
 */
export const getAllSettings = async () => {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value, setting_type");

    if (error) {
      console.error("Failed to fetch all settings:", error);
      return {};
    }

    const result = {};
    (data || []).forEach((row) => {
      const value = parseSettingValue(row.setting_value, row.setting_type);
      result[row.setting_key] = value;
      settingsCache.set(row.setting_key, value);
    });

    lastCacheUpdateTime = Date.now();
    return result;
  } catch (error) {
    console.error("Error getting all settings:", error);
    return {};
  }
};

/**
 * Set a setting value
 * @param {string} settingKey - The key of the setting
 * @param {any} settingValue - The value to set
 * @param {string} settingType - The type of the setting (string, number, boolean, json)
 * @param {string} description - Description of the setting
 * @returns {Promise<boolean>} Success status
 */
export const setSetting = async (
  settingKey,
  settingValue,
  settingType = "string",
  description = ""
) => {
  try {
    const stringValue = formatSettingValue(settingValue, settingType);

    const { error } = await supabase.from("app_settings").upsert(
      {
        setting_key: settingKey,
        setting_value: stringValue,
        setting_type: settingType,
        description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );

    if (error) {
      console.error(`Failed to set setting ${settingKey}:`, error);
      return false;
    }

    // Clear cache for this key
    settingsCache.delete(settingKey);
    lastCacheUpdateTime = 0;
    return true;
  } catch (error) {
    console.error(`Error setting ${settingKey}:`, error);
    return false;
  }
};

/**
 * Clear all settings cache
 */
export const clearSettingsCache = () => {
  settingsCache.clear();
  lastCacheUpdateTime = 0;
};

/**
 * Parse setting value based on type
 * @private
 */
function parseSettingValue(value, type) {
  if (!value) return null;

  switch (type.toLowerCase()) {
    case "number":
    case "integer":
      return Number(value);
    case "boolean":
      return String(value).toLowerCase() === "true";
    case "json":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    case "string":
    default:
      return String(value);
  }
}

/**
 * Format setting value to string based on type
 * @private
 */
function formatSettingValue(value, type) {
  switch (type.toLowerCase()) {
    case "json":
      return JSON.stringify(value);
    default:
      return String(value);
  }
}
