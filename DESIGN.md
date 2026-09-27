# Floorplanner — Studio UI Design

**Status:** Draft v1 · **Date:** 2026-09-26 · **Repo:** `Floorplanner`  
**Companion:** [REQUIREMENTS.md](REQUIREMENTS.md)

---

## 1. Purpose

This document specifies the **customer studio chrome** — the shell a homeowner or small-business owner uses to draw a building, walk through it in 3D, preview sheets, and order a drawing set.

It is a visual and interaction spec. The editor canvas stays the Pascal host (`<Editor layoutVersion="v2" />` in `studio/src/components/studio-shell.tsx`). The glass chrome wraps that host and fills its slots.

Staff surfaces (architect QA queue, engineer structural queue, admin) are out of this pass. They ship in later milestones and use a quieter, denser chrome.

---

## 2. Design principles

| # | Principle | How it shows up |
|---|---|---|
| P-1 | **A non-architect can finish a layout without training** (G-1) | One tool at a time. Plain labels. Empty states tell the next step. |
| P-2 | **The canvas is the product** | Chrome is glass and thin. The plan and the 3D model take the middle of the screen. |
| P-3 | **One model, two views** (`FR-30`) | 2D and 3D are the same building. An edit in either is visible in the other. |
| P-4 | **Draw first, account later** (G-4, `FR-70`) | No signup wall on the canvas. Sign-in appears on the first save. |
| P-5 | **Drawings only** (§1.3) | Copy never implies a council stamp, certification, approval, or guaranteed submission. |
| P-6 | **Icons carry the tool, words confirm it** | Lucide stroke icons at one size and weight. A short label sits under each rail icon. |

---

## 3. Visual system

The reference is the glass studio mock: floating panels over a bright sky, palm silhouettes, and a soft horizon. The studio is calm, open, and precise.

### 3.1 Backdrop

Full-viewport photographic backdrop:

- Clear tropical sky, pale horizon, out-of-focus palms
- Fixed, non-interactive, `pointer-events: none`
- Does not scroll with the plan
- A light white wash (`rgba(255, 255, 255, 0.18)`) sits over the photo so the grid and walls stay readable

If the photo fails to load, fall back to a vertical gradient: `#d8e8f6` → `#f4f7fb`.

### 3.2 Glass panels

Every chrome surface — top bar, tool rail, inspector, floating canvas toolbar, sheet strip, trace card — is a **glass panel**.

Each panel is two stacked layers:

1. **Frost** — samples the backdrop behind the panel and applies `#glass-refraction`. This layer has no text.
2. **Content** — icons, labels, inputs, and focus rings. This layer is **never** displaced.

Panel treatment:

| Token | Value |
|---|---|
| Fill | `rgba(255, 255, 255, 0.72)` |
| Border | `1px solid rgba(255, 255, 255, 0.85)` |
| Shadow | `0 8px 32px rgba(15, 35, 70, 0.10)` |
| Radius | `20px` (cards), `16px` (tool buttons), `999px` (pills) |
| Blur | `backdrop-filter: blur(18px)` in addition to the SVG filter |

`0.72` white is the floor for body text on glass. Do not drop fill below that on any control that carries copy. WCAG AA (4.5:1 for 14 px body, 3:1 for 12 px metadata) is measured against the *filled* panel, not the raw photo.

### 3.3 Refraction filter

Mount once at the document root, hidden, zero size:

```html
<svg class="hidden-svg" width="0" height="0" aria-hidden="true">
  <filter id="glass-refraction" x="0%" y="0%" width="100%" height="100%">
    <!-- Generate organic fluid noise -->
    <feTurbulence
      type="fractalNoise"
      baseFrequency="0.02"
      numOctaves="2"
      result="noise"
    />
    <!-- Displace graphic pixels based on noise channels -->
    <feDisplacementMap
      in="SourceGraphic"
      in2="noise"
      scale="30"
      xChannelSelector="R"
      yChannelSelector="G"
    />
  </filter>
</svg>
```

Apply `filter: url(#glass-refraction)` only to the frost layer. `scale="30"` is the visual target; if a panel’s edge shimmers into neighbouring chrome, lower scale on that panel only — never on the content layer.

`prefers-reduced-motion: reduce` — skip any animated turbulence. A static frost plus blur is enough.

### 3.4 Colour

| Role | Value | Use |
|---|---|---|
| Ink | `#1a2330` | Body, icon stroke, primary labels |
| Ink muted | `#5b6775` | Helper text, inactive tools, units second line |
| Accent | `#3b82f6` | Selected tool, primary button, focus ring |
| Accent soft | `rgba(59, 130, 246, 0.12)` | Selected-tool well |
| Danger | `#dc4c4c` | Delete, destructive confirm |
| Canvas | `#f3f6fa` at 88% | Plan sheet behind walls |
| Grid | `rgba(26, 35, 48, 0.08)` | 1 m grid |
| Success | `#2f8f5b` | Saved, released-available |

Focus ring: `0 0 0 2px #ffffff, 0 0 0 4px #3b82f6`. Visible on every non-canvas control (`NFR-11`).

### 3.5 Type

| Role | Face | Size / weight |
|---|---|---|
| Wordmark | Geist Sans | 15 px / 600 |
| Tool label | Geist Sans | 11 px / 500 |
| Panel title | Geist Sans | 13 px / 600 |
| Body | Geist Sans | 13 px / 400 |
| Field value | Geist Sans | 13 px / 500 |
| Unit second line | Geist Mono | 11 px / 400, muted |
| Sheet code | Geist Mono | 11 px / 500 |

Customer chrome never uses CAD terms: *node, poché, viewport, scene, graph, underlay, jurisdiction profile*. Internal names stay in code and in this spec. See §10.

### 3.6 Icons

All customer icons are **Lucide** (`lucide-react`, already in `studio/package.json`).

- Size: **20 px** in the tool rail and top bar; **16 px** inside compact buttons
- Stroke: `1.75`
- Colour: ink, or accent when selected
- No filled pictograms, no mixed icon families, no emoji

---

## 4. Layout

Wide desktop (≥ 1280 px). Regions match the mock.

```
┌─────────────────────────────────────────────────────────────────┐
│ Top bar                                                         │
├────┬──────────────────────────────────────────────┬─────────────┤
│    │                                              │             │
│ T  │           2D plan          3D model          │ Inspector   │
│ o  │                                              │             │
│ o  │         [ floating canvas toolbar ]          │ Properties  │
│ l  │                                              │ Project     │
│    │                                              │             │
│ R  │                                              │             │
│ a  │                                              │             │
│ i  │                                              │             │
│ l  │                                              │             │
├────┴──────────────────────────────────────────────┴─────────────┤
│ Sheet strip                              │ Trace a plan         │
└──────────────────────────────────────────┴──────────────────────┘
```

| Region | Width / height | Notes |
|---|---|---|
| Top bar | 56 px, full width | Glass, 16 px inset from viewport |
| Tool rail | 72 px | Icon + label stacked |
| Canvas | Fluid | Plan and model share the remaining width 50 / 50 |
| Inspector | 300 px | Collapses to a 40 px handle |
| Sheet strip | 148 px tall | Horizontal scroll |
| Trace card | 280 px wide, same row as sheets | Right of the strip |

Insets: 16 px from the viewport edge. 12 px gutters between panels. The canvas is the only surface that goes edge-to-edge *inside* its panel; chrome never overlays walls.

On 1024–1279 px: inspector collapses by default; **2D / 3D / Both** defaults to a single view (last used). Below 1024 px see §12 (view-only).

---

## 5. Top bar

Left → right.

| Control | Icon | Behaviour |
|---|---|---|
| Wordmark | — | “Floorplanner”. Links to the project list. |
| Project name | `ChevronsUpDown` (12 px, trailing) | Opens a menu: rename, duplicate, archive. Shows the current name, e.g. *Everglow Guesthouse*. |
| Undo | `Undo2` | Disabled when the undo stack is empty. Tooltip: **Undo** + shortcut. |
| Redo | `Redo2` | Same for redo. |
| Autosave | `Cloud` / `LoaderCircle` / `CloudOff` | **Saved** · **Saving…** · **Offline — saved on this device**. Autosave is continuous (`FR-1F`); this is status, not a button. |
| Spacer | | |
| Status chip | — | See §9. Hidden while the project is still `Designing` and unpaid. |
| Order drawings | — | Primary pill. Accent fill, white label. Opens the order sheet (§11). |
| Account | `CircleUser` | Sign in, or the user’s initial once signed in. |

No Share control. Sharing is not in v1.

Keyboard: every top-bar control is reachable. Undo / redo also bind `Ctrl+Z` / `Ctrl+Shift+Z` (`Cmd` on macOS).

---

## 6. Tool rail

One tool at a time. Clicking a tool selects it and, where the Pascal host needs a panel (Furniture, Rooms), opens that panel in the inspector. Re-clicking the active panel tool collapses the inspector. Select is the default after Esc, after a completed wall, and after placing a door or window.

### 6.1 Drawing tools

| Order | Label | Lucide | What the customer does | Requirement |
|---|---|---|---|---|
| 1 | Select | `MousePointer2` | Click to pick. Drag to move. | Default |
| 2 | Walls | `BrickWall` | Click a path. Ortho lock and snap are on. Live length follows the cursor. | `FR-10`, `FR-11` |
| 3 | Doors | `DoorOpen` | Click a wall. The opening cuts the wall in 2D and 3D. | `FR-14` |
| 4 | Windows | `AppWindow` | Click a wall. Same cut rule. | `FR-14` |
| 5 | Rooms | `Pentagon` | Closed wall loops become rooms with a name and m². Rename here or on the plan. | `FR-13` |
| 6 | Furniture | `Sofa` | Browse the catalogue; drag onto the plan. | `FR-20`, `FR-21` |
| 7 | Stairs | `ArrowUpFromLine` | Place a stair. Rise, going, and width are in the inspector. | `FR-16` |
| 8 | Notes | `Type` | Click to type a note on the plan. | Annotation |
| 9 | Dimensions | `Ruler` | Override or add a dimension string. Auto dimensions stay on unless hidden. | `FR-1A` |

### 6.2 Below the divider

| Label | Lucide | Behaviour |
|---|---|---|
| Projects | `FolderOpen` | Opens the project list overlay. Does not leave the studio. |
| Help | `CircleHelp` | Short overlay: draw the plot, draw a wall, switch to 3D. No CAD manual. |

### 6.3 Rail treatment

- Idle: ink icon, muted label, no well
- Hover: `rgba(255, 255, 255, 0.45)` well
- Selected: accent icon, accent label, `Accent soft` well
- Hit target: 56 × 56 px
- Tooltip on hover delay (400 ms) repeats the label and, for Walls / Doors / Windows, one line of how-to: *Click to start. Click to add a corner. Enter to finish.*

Tools that are not yet implemented stay visible and disabled, with tooltip **Coming soon**. Do not hide them; the rail is the product map.

---

## 7. Canvas

### 7.1 Dual view

On wide screens the canvas panel is split:

- **Left — 2D plan.** Orthographic. Grid, snap, room names, m², dual-unit dimensions.
- **Right — 3D model.** The same building. Orbit / pan / zoom (`FR-31`).

A segmented control floats at the top-centre of the canvas panel:

**2D** · **3D** · **Both**

| Mode | Layout |
|---|---|
| Both | 50 / 50 split (default ≥ 1280 px) |
| 2D | Plan fills the canvas; model stays mounted and hidden |
| 3D | Model fills the canvas; plan stays mounted and hidden |

Keep both views mounted so switching never re-inits WebGL / WebGPU (`NFR-1`, `NFR-4`).

### 7.2 Floating canvas toolbar

Glass pill, top-left of the canvas, 8 px below the panel edge.

| Control | Icon | Default |
|---|---|---|
| Undo | `Undo2` | — |
| Redo | `Redo2` | — |
| Delete | `Trash2` | Enabled when something is selected |
| Snap | `Magnet` | On |
| Grid | `Grid3x3` | On |
| Show dimensions | `Ruler` | On |
| Level | `Layers` + chevron | **Ground floor** |

Level menu, in order (`FR-17`):

1. Ground floor
2. First floor
3. Second floor
4. Terrace
5. Roof

Each row shows the floor-to-floor height (default 3,000 mm). **Add a floor** at the bottom copies the current floor’s walls as a starting point (`FR-18`). Adding a storey after release is a re-review event — warn before commit (§11.3).

A small north arrow sits at the bottom-right of the 2D plan. It is decorative wayfinding here; project north is set under Project.

### 7.3 Plan content

- Walls render as filled strokes at their real thickness
- Rooms show **name + area in m²** in the centre of the zone (`FR-13`)
- Dimensions: millimetres on the first line, `[ft'-in"]` on the second (`FR-1B`)
- Doors and windows show their type tag (`D01`, `W01`…) once placed (`FR-15`)
- Furniture uses the catalogue’s 2D symbol, never a mesh projection (`FR-24`)
- Collision with a wall or another item flags the item; placement is not blocked (`FR-23`)

### 7.4 First-run hint

On an empty Ground floor, a single glass card in the centre of the plan:

> **Start with the plot, then a wall.**
> Choose **Walls** on the left, or **Trace a plan** below if you already have a drawing.

Dismiss on the first wall, the first plot edge, or an Escape. Do not show again on this project.

### 7.5 3D extras (chrome, not a second toolbar)

Reached from a compact menu on the 3D side (`Box` icon, **View**):

- Walk through — eye height 1,600 mm (`FR-32`)
- Cut through — movable section plane (`FR-33`)
- Explode floors (`FR-34`)
- Show / hide a floor (`FR-35`)
- Time of day (`FR-37`)
- Save a picture — free, no watermark (`FR-38`)

Doors open and close on click in 3D (`FR-39`).

---

## 8. Inspector

Two tabs: **Properties** and **Project**.

### 8.1 Properties — selection

The inspector always answers “what is this, and what can I change?” Empty selection never shows a blank form.

**Nothing selected**

> Draw a wall, or select something on the plan.

Then two buttons: **Draw walls** (switches to Walls) and **Browse furniture**.

**Wall selected**

| Field | Control | Notes |
|---|---|---|
| Thickness | Select | Presets from `FR-12`: **External** 150 mm block + 25 mm plaster · **Internal** 100 mm. Custom mm allowed. |
| Height | Number | Default 2,700 mm (storey default 3,000 mm minus slab). Dual unit under the field. |
| Material | Select | Concrete, block, timber — customer words. |
| Finish (inside) | Select | Feeds `FR-36` / finishing notes. |
| Finish (outside) | Select | External walls only. |
| Length | Readout | Dual units, live while dragging. |
| Angle | Readout | Degrees. |
| Lock | Switch | Locked walls cannot be dragged. |

**Door or window selected**

Type (`D01`… / `W01`…), width × height, swing / hinge, and the running count for that type (`FR-15`). Changing size to a new pair creates a new type tag.

**Room selected**

Editable name. Area in m² (computed, not typed). Assigned finish.

**Furniture selected**

Name, dimensions, rotate (15° snap + free), mirror. Scale only if the catalogue entry allows it (`FR-22`).

**Stair selected**

Rise, going, width. Preview of UP / DOWN and tread count.

### 8.2 Project tab

Fields that populate the title block (`FR-71`, `FR-520`):

- Project name
- Client name
- Location
- Plot name
- Building type
- Date
- North direction

Plot size and computed plot / footprint areas (`FR-1D`) are readouts on this tab.

Copy on this tab stays factual. No sentence about council, stamps, or “submission ready”.

---

## 9. Status chip

Shown in the top bar once the customer has paid or a reviewer has acted. Labels match `FR-78` exactly:

| Status | Chip label | Tone |
|---|---|---|
| Designing | *(hidden)* | — |
| Paid | Paid — in review soon | Ink |
| In architect review | In architect review · {turnaround} | Accent |
| Changes requested | Changes requested | Danger |
| Released | Drawings ready | Success |
| Structural in progress | Structural drawings in progress | Accent |
| Complete | Complete — final set ready | Success |

The chip is a link to the order / downloads panel. It never says *approved*, *stamped*, or *certified*.

---

## 10. Customer language

| Internal term | Customer label |
|---|---|
| Scene / node / graph | *(omitted)* — “your building”, “the plan”, “the model” |
| Zone | Room |
| Level | Floor |
| Underlay | Traced plan |
| Sheet | Drawing |
| Sheet set | Drawing set |
| Export job | Preparing drawings… |
| Jurisdiction profile | *(omitted)* |
| Stamp reserve | *(omitted in chrome — it exists on the PDF only)* |
| Release | Drawings ready |
| QA | Architect review |

---

## 11. Order drawings

**Order drawings** opens a glass sheet over the canvas (modal). Design, 3D, and the watermarked preview stay free (`FR-73`, `FR-531`).

### 11.1 Before payment

1. Thumbnail strip of every sheet in the watermarked preview.
2. Price in **MVR**, from the admin setting — never a hard-coded figure.
3. Turnaround target for architect review (`FR-Q7`), shown *before* pay.
4. Three sentences, in this order:

> Design and 3D are free.
> Payment starts an architect review. You get the drawing file after that review is finished.
> You take the set to council yourself. This is a drawing set, not a council stamp.

The confirm button label is **Pay and send for review**.

### 11.2 After payment, before release

The same sheet shows status, the turnaround target, and **no download** of the clean PDF. The watermarked preview remains.

### 11.3 Re-review warning

If the customer adds or removes a floor, or changes the building footprint past the configured tolerance (`FR-75`):

> This change needs another review and a re-review fee of {amount} MVR. Your current drawings stay available until you confirm.

The edit does not commit until they confirm. Sub-threshold edits (moving a wall inside, swapping furniture, renaming a room, changing a finish) never show this.

### 11.4 Forbidden copy

Do not use, in any chrome, tooltip, email, or PDF cover:

- certified, certification
- stamped, stamp (except the PDF’s existing dashed reserve caption, which is a layout instruction)
- approved, approval (status uses “review” and “ready”)
- submission-guaranteed, council-ready, planning-approved

---

## 12. Sheet strip and Trace a plan

Bottom of the studio, one glass row.

### 12.1 Drawing sheets (preview)

Horizontal strip of sheet thumbnails. Labelled as **Drawing sheets (preview)** — the word *preview* is always present. Use the Maldives sheet codes with plain titles:

| Code | Customer title | Source |
|---|---|---|
| A.00 | Site plan | `FR-501` |
| A.01 | Ground floor plan | `FR-502` |
| A.02 | First floor plan | `FR-502` |
| A.03 | Terrace plan | `FR-502` |
| A.04 | Roof plan | `FR-502` |
| A.05 | Elevation 1 | `FR-503` |
| A.06 | Elevation 2 | `FR-503` |
| A.07 | Section | `FR-504` |
| A.08 | Door schedule | `FR-505` |
| A.08a | Window schedule | `FR-506` |
| A.09 | Stair detail | `FR-507` |
| A.10 | Ceiling details | `FR-508` |
| A.11 | Ceiling details | `FR-508` |
| A.12 | Toilet details | `FR-509` |
| A.13 | AC and flooring | `FR-510` |

Tiles that are not generated yet show a faint empty frame and the title. Clicking a ready tile opens the watermarked sheet in a lightbox. The customer cannot edit elevations, sections, or any generated sheet (`FR-Q8`).

### 12.2 Trace a plan

Right-hand card, same row.

**Trace a plan**

> Upload a floor plan (PDF or image). Scale it, then draw over it.

Primary control: **Upload file** (`Upload` icon).

Flow (`FR-40`–`FR-43`):

1. Choose JPG, PNG, or one page from a PDF. Max 25 MB.
2. Assign to the current floor.
3. **Scale:** click two points on a length you know, type that length. Dual-unit field.
4. Move, rotate (free / 90°), flip.
5. Opacity slider. **Lock** so drafting does not drag the image.

Helper line: *The traced image is a guide. It does not appear on the drawings.* (`FR-45`)

One traced plan per floor. The card switches to **Replace** + opacity + lock once one is set.

---

## 13. Furniture catalogue (inspector, Furniture tool)

When Furniture is active, the inspector lists `FR-20` categories with a search field (`Search` icon).

| Category | Lucide |
|---|---|
| Beds and bedroom | `BedDouble` |
| Seating | `Armchair` |
| Dining | `Utensils` |
| Kitchen | `CookingPot` |
| Bathroom | `Bath` |
| Storage | `Archive` |
| Other | `Shapes` |

Each item shows the 2D symbol, name, and bounding size. Drag onto the plan; it sits on the floor and, where it belongs against a wall, orients back-to-wall (`FR-21`).

---

## 14. States

| State | Surface |
|---|---|
| Loading studio | Centre of canvas: **Loading studio…** (already in `studio-shell.tsx`) |
| Editor failed | Existing error panel: registry failed, drawing tools unavailable |
| Empty project | First-run hint (§7.4) |
| Visitor, first save | Modal: **Save your project** — email sign-in. Work carries over (`FR-70`). Drawing stays on screen behind the glass. |
| Offline | Autosave shows **Offline — saved on this device**. Banner only if a server write has been pending > 10 s. |
| Preparing drawings | Sheet strip tiles pulse; top bar: **Preparing drawings…** (`FR-530`) |
| Changes requested | Status chip + a notes card in the inspector Project tab |
| Mobile | §15 |

Undo / redo: minimum 50 steps (`FR-1E`). The buttons disable at the ends of the stack.

---

## 15. Mobile (`NFR-2`)

Editing is desktop-only. On a narrow viewport:

- No tool rail
- No inspector
- No trace upload
- 3D view (orbit) and, when released, **Download drawings**
- A short line: **Editing is on a computer.**

Do not offer a broken subset of drawing tools.

---

## 16. Motion and accessibility

- Tool changes and view switches: 150 ms fade, no bounce
- Sheet strip: native overflow scroll, no auto-play
- `prefers-reduced-motion: reduce`: no refraction animation, no pulse on export tiles
- Keyboard for all non-canvas UI (`NFR-11`)
- Tool rail is a `tablist`; canvas remains a pointing-device surface
- Hit targets ≥ 44 px on pills and rail buttons
- Do not rely on colour alone for selected tool — the well + accent stroke + label weight change together

---

## 17. Implementation notes

- Host the glass shell in the Next.js app around `<Editor layoutVersion="v2" />`. Prefer Pascal slots (`navbarSlot`, `sidebarTabs`, `viewerToolbarLeft` / `Right`, `inspectorFooter`) before wrapping the whole editor.
- Icons: `lucide-react` only, names in §6 and §13.
- The SVG filter lives in `studio/src/app/layout.tsx` (or a `GlassRoot` used by the studio layout) so every panel can `url(#glass-refraction)`.
- Backdrop is a CSS `background-image` on a studio layout wrapper, not a Three.js texture.
- Do not invent a Share button, a public gallery, or a “submit to council” action.
- Staff queues are a separate design; do not reuse this glass language there.

---

## 18. Out of scope (this document)

- Architect QA queue and sheet-override UI (`FR-Qx`)
- Engineer structural queue and S-series upload (`FR-8x`)
- Admin pricing, catalogue, and profile editors (`FR-9x`)
- Marketing / landing page beyond the current home link into `/studio`
- Icon animation, 3D tool icons, or a custom icon font
