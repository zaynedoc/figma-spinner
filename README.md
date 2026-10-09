# Figma Field Day Spinner

An inventory-aware Figma merch prize wheel, styled from the linked Higher Ed brand board and its FigMural composition system. The interface uses Inter throughout, keeps mural clusters confined to the page corners, and moves secondary controls behind the bottom-left settings button.

## Run locally

```bash
npm install
npm run dev
```

Use `npm run build` for a production build. With the dev server running, `npm run qa` runs the desktop/mobile browser checks.

## Odds model

Each merch type is weighted by `quantity × size factor`:

- Small: `1.35×`
- Medium: `1×`
- Large: `0.62×`

Grouped mode combines each type into one proportional slice. By-unit mode draws every in-stock piece as its own slice while retaining the same size-adjusted probability.

All inventory, color, motion, mode, and type settings autosave to local storage. Export and import use a versioned JSON format.
