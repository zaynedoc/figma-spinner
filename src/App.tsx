import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AppSettings,
  buildSlices,
  defaultItems,
  defaultSettings,
  isSavedSpinner,
  MerchItem,
  pickWinner,
  probabilities,
  SavedSpinner,
  SizeBand,
} from "./wheel";

const storageKey = "figma-field-day-spinner-v2";
const legacyStorageKey = "figma-field-day-spinner-v1";

function loadInitial(): SavedSpinner {
  try {
    const currentSaved = localStorage.getItem(storageKey);
    const saved = currentSaved ?? localStorage.getItem(legacyStorageKey);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (isSavedSpinner(parsed)) {
        return {
          ...parsed,
          settings: {
            ...parsed.settings,
            typeface: "inter",
            showInventory: currentSaved ? (parsed.settings.showInventory ?? false) : false,
          },
        };
      }
    }
  } catch {
    // A damaged local draft should never prevent the spinner from opening.
  }
  return { version: 1, settings: defaultSettings, items: defaultItems };
}

function Icon({ name }: { name: "download" | "upload" | "plus" | "trash" | "spark" | "settings" | "close" }) {
  const paths = {
    download: <><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M5 17v3h14v-3"/></>,
    upload: <><path d="M12 21V10m0 0 4 4m-4-4-4 4"/><path d="M5 7V4h14v3"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    trash: <><path d="M5 7h14M9 7V4h6v3M8 10v8m4-8v8m4-8v8M7 21h10l1-14H6z"/></>,
    spark: <><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34H9A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06a1.7 1.7 0 0 0-.34 1.88v.03A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function App() {
  const initial = useMemo(loadInitial, []);
  const [items, setItems] = useState<MerchItem[]>(initial.items);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [winner, setWinner] = useState<MerchItem | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [notice, setNotice] = useState("");
  const [rotation, setRotation] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const slices = useMemo(() => buildSlices(items, settings.mode), [items, settings.mode]);
  const odds = useMemo(() => probabilities(items), [items]);
  const totalStock = items.reduce((sum, item) => sum + item.quantity, 0);
  const activeItems = items.filter((item) => item.quantity > 0);

  useEffect(() => {
    const data: SavedSpinner = { version: 1, settings, items };
    localStorage.setItem(storageKey, JSON.stringify(data));
  }, [items, settings]);

  const wheelBackground = useMemo(() => {
    if (!slices.length) return "#e2e1d8";
    return `conic-gradient(from 0deg, ${slices
      .map((slice) => `${slice.color} ${slice.start}deg ${slice.end}deg`)
      .join(", ")})`;
  }, [slices]);

  function updateItem(id: string, patch: Partial<MerchItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function addItem() {
    const id = `merch-${Date.now()}`;
    const palette = ["#ff01e5", "#5146ff", "#c4baff", "#7b2020", "#a9db73"];
    setItems((current) => [
      ...current,
      { id, name: "New merch", quantity: 5, size: "medium", color: palette[current.length % palette.length] },
    ]);
    setNotice("New merch added");
  }

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function spin() {
    const element = wheelRef.current;
    const selected = pickWinner(items);
    if (!element || !selected || isSpinning) return;

    const selectedSlices = slices.filter((slice) => slice.itemId === selected.id);
    const targetSlice = selectedSlices[Math.floor(Math.random() * selectedSlices.length)];
    if (!targetSlice) return;

    setWinner(null);
    setNotice("");
    setIsSpinning(true);

    const currentNormalized = ((rotation % 360) + 360) % 360;
    const targetNormalized = (360 - targetSlice.center) % 360;
    const alignment = (targetNormalized - currentNormalized + 360) % 360;
    const targetRotation = rotation + 5 * 360 + alignment;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 80 : settings.duration * 1000;
    const keyframes: Keyframe[] = settings.fakeouts && !reduceMotion
      ? [
          { transform: `rotate(${rotation}deg)`, offset: 0, easing: "cubic-bezier(.12,.72,.17,1)" },
          { transform: `rotate(${targetRotation + 13}deg)`, offset: 0.86, easing: "cubic-bezier(.34,1.56,.64,1)" },
          { transform: `rotate(${targetRotation - 7}deg)`, offset: 0.93, easing: "ease-out" },
          { transform: `rotate(${targetRotation + 2}deg)`, offset: 0.975, easing: "ease-in-out" },
          { transform: `rotate(${targetRotation}deg)`, offset: 1 },
        ]
      : [
          { transform: `rotate(${rotation}deg)`, easing: "cubic-bezier(.12,.72,.17,1)" },
          { transform: `rotate(${targetRotation}deg)` },
        ];

    const animation = element.animate(keyframes, { duration, fill: "forwards" });
    animation.onfinish = () => {
      setRotation(targetRotation);
      element.style.transform = `rotate(${targetRotation}deg)`;
      setWinner(selected);
      setIsSpinning(false);
    };
    animation.oncancel = () => setIsSpinning(false);
  }

  function exportJson() {
    const data: SavedSpinner = { version: 1, settings, items };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "figma-merch-spinner.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("JSON exported");
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        if (!isSavedSpinner(parsed)) throw new Error("Invalid spinner file");
        setItems(parsed.items);
        setSettings({ ...parsed.settings, typeface: "inter", showInventory: parsed.settings.showInventory ?? true });
        setWinner(null);
        setNotice("Spinner settings imported");
      } catch {
        setNotice("That JSON file isn’t a valid spinner setup");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="app-shell">
      <img className="corner-art corner-art--top-left" src="/topleft.png" alt="" aria-hidden="true" />
      <img className="corner-art corner-art--top-right" src="/topright.png" alt="" aria-hidden="true" />
      <img className="corner-art corner-art--bottom-left" src="/bottomleft.png" alt="" aria-hidden="true" />
      <img className="corner-art corner-art--bottom-right" src="/bottomright.png" alt="" aria-hidden="true" />
      <main id="top" className="workspace">
        <div className={`app-grid ${settings.showInventory ? "" : "inventory-hidden"}`}>
          <section className="wheel-stage" aria-label="Prize wheel">
            <div className="wheel-wrap">
              <div className="pointer" aria-hidden="true"><span /></div>
              <div className="wheel-shadow" />
              <div ref={wheelRef} className={`wheel ${settings.mode === "units" ? "unit-mode" : ""}`} style={{ background: wheelBackground, transform: `rotate(${rotation}deg)` }}>
                <div className="wheel-grid" aria-hidden="true" />
                {activeItems.map((item) => {
                  const groupedSlice = buildSlices(items, "grouped").find((slice) => slice.itemId === item.id);
                  if (!groupedSlice || (groupedSlice.end - groupedSlice.start) < 18) return null;
                  const angle = groupedSlice.center;
                  return (
                    <span key={item.id} className="wheel-label" style={{ "--label-angle": `${angle}deg` } as React.CSSProperties}>
                      <b>{item.name}</b><small>{Math.round((odds.get(item.id) ?? 0) * 100)}%</small>
                    </span>
                  );
                })}
                <div className="wheel-center" aria-hidden="true"><img src="/figma-assets/flower.svg" alt="" /></div>
              </div>
              <button className={`spin-button ${isSpinning ? "is-spinning" : ""}`} onClick={spin} disabled={isSpinning || totalStock === 0}>
                <span>{isSpinning ? "Spinning" : "Spin"}</span><small>{settings.duration.toFixed(1)}s</small>
              </button>
            </div>
            {winner && <div className="winner-card visible" aria-live="polite">
              <span className="winner-swatch" style={{ background: winner.color }} /><div><small>The wheel chose</small><strong>{winner.name}</strong></div><span className="winner-count">{winner.quantity} left</span>
            </div>}
            <p className="live-notice" role="status" aria-live="polite">{notice}</p>
          </section>

          {settings.showInventory && <aside className="inventory-panel panel" aria-label="Merch inventory">
            <div className="panel-heading inventory-heading">
              <div><p className="kicker">Inventory</p><h2>What’s up for grabs?</h2></div>
              <button className="add-button" onClick={addItem} aria-label="Add merch"><Icon name="plus" /></button>
            </div>
            <div className="odds-key"><span>Size bias</span><i /> small 1.35× <i /> medium 1× <i /> large .62×</div>
            <div className="inventory-list">
              {items.map((item, index) => (
                <article className="inventory-item" key={item.id}>
                  <div className="item-index">{String(index + 1).padStart(2, "0")}</div>
                  <input className="color-input" type="color" value={item.color} onChange={(event) => updateItem(item.id, { color: event.target.value })} aria-label={`${item.name} color`} />
                  <div className="item-fields">
                    <input className="name-input" value={item.name} maxLength={26} onChange={(event) => updateItem(item.id, { name: event.target.value })} aria-label="Merch name" />
                    <div className="item-subrow">
                      <select value={item.size} onChange={(event) => updateItem(item.id, { size: event.target.value as SizeBand })} aria-label={`${item.name} size`}>
                        <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
                      </select>
                      <label className="qty-control"><span>Qty</span><input type="number" min="0" max="99" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Math.min(99, Number(event.target.value) || 0)) })} /></label>
                    </div>
                  </div>
                  <div className="item-odds"><strong>{((odds.get(item.id) ?? 0) * 100).toFixed(1)}%</strong><span>odds</span></div>
                  <button className="delete-button" onClick={() => deleteItem(item.id)} aria-label={`Delete ${item.name}`} disabled={items.length === 1}><Icon name="trash" /></button>
                </article>
              ))}
            </div>
            <div className="inventory-summary"><span>Total inventory</span><strong>{totalStock} <small>pieces</small></strong></div>
          </aside>}
        </div>
      </main>

      {settingsOpen && (
        <aside id="spinner-settings" className="control-panel panel settings-popover" aria-label="Wheel settings">
          <div className="panel-heading settings-heading">
            <div><p className="kicker">Settings</p><h2>How should it spin?</h2></div>
            <button className="close-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><Icon name="close" /></button>
          </div>

          <fieldset className="field-group">
            <legend>Inventory view</legend>
            <div className="segmented-control">
              <button className={settings.mode === "grouped" ? "active" : ""} onClick={() => setSettings((s) => ({ ...s, mode: "grouped" }))}><strong>Grouped</strong><span>One slice per item</span></button>
              <button className={settings.mode === "units" ? "active" : ""} onClick={() => setSettings((s) => ({ ...s, mode: "units" }))}><strong>By unit</strong><span>Every piece visible</span></button>
            </div>
          </fieldset>

          <div className="field-group range-field">
            <div className="label-row"><label htmlFor="duration">Spin tempo</label><output>{settings.duration.toFixed(1)} sec</output></div>
            <input id="duration" type="range" min="2" max="7" step="0.1" value={settings.duration} onChange={(event) => setSettings((s) => ({ ...s, duration: Number(event.target.value) }))} />
            <div className="range-labels"><span>Quick</span><span>Suspenseful</span></div>
          </div>

          <label className="toggle-row">
            <span><strong>Inertia fakeout</strong><small>Overshoot, rebound, then land.</small></span>
            <input type="checkbox" checked={settings.fakeouts} onChange={(event) => setSettings((s) => ({ ...s, fakeouts: event.target.checked }))} />
            <i aria-hidden="true" />
          </label>

          <label className="toggle-row">
            <span><strong>Inventory panel</strong><small>Show merch and live odds.</small></span>
            <input
              type="checkbox"
              aria-label="Show inventory panel"
              checked={settings.showInventory}
              onChange={(event) => setSettings((s) => ({ ...s, showInventory: event.target.checked }))}
            />
            <i aria-hidden="true" />
          </label>

          <div className="json-actions">
            <button onClick={exportJson}><Icon name="download" />Export JSON</button>
            <button onClick={() => importRef.current?.click()}><Icon name="upload" />Import</button>
            <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importJson} />
          </div>
          <p className="save-note"><span className="autosave-dot"><i />Saved locally</span></p>
        </aside>
      )}

      <button
        className={`settings-fab ${settingsOpen ? "active" : ""}`}
        onClick={() => setSettingsOpen((open) => !open)}
        aria-label={settingsOpen ? "Close settings" : "Open settings"}
        aria-expanded={settingsOpen}
        aria-controls="spinner-settings"
      >
        <Icon name="settings" />
      </button>
    </div>
  );
}

export default App;
