import mongoose from "mongoose";

export const APP_SETTINGS_KEY = "app-settings";

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: APP_SETTINGS_KEY,
    },
    showIcons: { type: Boolean, default: true },
    commandPalettePosition: {
      type: String,
      default: "top-center",
      trim: true,
    },
    stackGroups: { type: Boolean, default: false },
    stackMaxVisible: { type: Number, default: 3, min: 0, max: 20 },
    autoScrollSpeed: { type: Number, default: 0, min: 0, max: 100 },
    sidebarVisible: { type: Boolean, default: true },
    showCalendarHeatmap: { type: Boolean, default: true },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

settingsSchema.set("toJSON", {
  transform: (_, result) => {
    delete result._id;
    delete result.key;
    return result;
  },
});

export const SettingsModel = mongoose.model("Settings", settingsSchema);
