export type SizeBand = "small" | "medium" | "large";
export type WheelMode = "grouped" | "units";

export interface MerchItem {
  id: string;
  name: string;
  quantity: number;
  size: SizeBand;
  color: string;
}

export interface AppSettings {
  mode: WheelMode;
  duration: number;
  fakeouts: boolean;
  typeface: "inter" | "rounded" | "mono";
  showInventory: boolean;
}

export interface SavedSpinner {
  version: 1;
  settings: AppSettings;
  items: MerchItem[];
}

export interface WheelSlice {
  id: string;
  itemId: string;
  name: string;
  color: string;
  weight: number;
  start: number;
  end: number;
  center: number;
}

export const sizeFactors: Record<SizeBand, number> = {
  small: 1.35,
  medium: 1,
  large: 0.62,
};

export const defaultItems: MerchItem[] = [
  { id: "socks", name: "FigJam Socks", quantity: 24, size: "small", color: "#ff01e5" },
  { id: "tee", name: "Campus Tee", quantity: 16, size: "medium", color: "#5146ff" },
  { id: "tote", name: "Maker Tote", quantity: 10, size: "medium", color: "#b8afff" },
  { id: "hoodie", name: "Studio Hoodie", quantity: 6, size: "large", color: "#7b2020" },
  { id: "stickers", name: "Sticker Pack", quantity: 32, size: "small", color: "#a9db73" },
];

export const defaultSettings: AppSettings = {
  mode: "grouped",
  duration: 4.2,
  fakeouts: true,
  typeface: "inter",
  showInventory: false,
};

export function itemWeight(item: MerchItem): number {
  return Math.max(0, item.quantity) * sizeFactors[item.size];
}

export function probabilities(items: MerchItem[]): Map<string, number> {
  const total = items.reduce((sum, item) => sum + itemWeight(item), 0);
  return new Map(items.map((item) => [item.id, total ? itemWeight(item) / total : 0]));
}

function shiftHex(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(clean)) return hex;
  const value = Number.parseInt(clean, 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255].map((channel) =>
    Math.max(0, Math.min(255, channel + amount)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function buildSlices(items: MerchItem[], mode: WheelMode): WheelSlice[] {
  const active = items.filter((item) => item.quantity > 0);
  const drafts =
    mode === "grouped"
      ? active.map((item) => ({
          id: item.id,
          itemId: item.id,
          name: item.name,
          color: item.color,
          weight: itemWeight(item),
        }))
      : active.flatMap((item) =>
          Array.from({ length: item.quantity }, (_, index) => ({
            id: `${item.id}-${index + 1}`,
            itemId: item.id,
            name: item.name,
            color: shiftHex(item.color, index % 2 === 0 ? 0 : 14),
            weight: sizeFactors[item.size],
          })),
        );

  const total = drafts.reduce((sum, slice) => sum + slice.weight, 0);
  let cursor = 0;
  return drafts.map((slice) => {
    const start = cursor;
    cursor += total ? (slice.weight / total) * 360 : 0;
    return { ...slice, start, end: cursor, center: (start + cursor) / 2 };
  });
}

export function pickWinner(items: MerchItem[], random = Math.random()): MerchItem | null {
  const active = items.filter((item) => item.quantity > 0);
  const total = active.reduce((sum, item) => sum + itemWeight(item), 0);
  if (!total) return null;
  let cursor = random * total;
  for (const item of active) {
    cursor -= itemWeight(item);
    if (cursor <= 0) return item;
  }
  return active.at(-1) ?? null;
}

export function isSavedSpinner(value: unknown): value is SavedSpinner {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedSpinner>;
  if (candidate.version !== 1 || !candidate.settings || !Array.isArray(candidate.items)) return false;
  const validSettings =
    ["grouped", "units"].includes(candidate.settings.mode) &&
    Number.isFinite(candidate.settings.duration) &&
    candidate.settings.duration >= 1.5 &&
    candidate.settings.duration <= 8 &&
    typeof candidate.settings.fakeouts === "boolean" &&
    ["inter", "rounded", "mono"].includes(candidate.settings.typeface) &&
    (candidate.settings.showInventory === undefined || typeof candidate.settings.showInventory === "boolean");
  return (
    validSettings &&
    candidate.items.length > 0 &&
    candidate.items.every(
      (item) =>
        typeof item?.id === "string" &&
        typeof item.name === "string" &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 0 &&
        item.quantity <= 99 &&
        ["small", "medium", "large"].includes(item.size) &&
        /^#[0-9a-f]{6}$/i.test(item.color),
    )
  );
}
