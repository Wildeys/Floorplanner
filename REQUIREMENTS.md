# Online Drawing Studio — Requirements

**Status:** Draft v1 · **Date:** 2026-09-26 · **Repo:** `Floorplanner`

---

## 1. Overview & Goals

### 1.1 Problem

Small architectural jobs — a house, a guesthouse, a shop fit-out — need a full drawing set for council submission. Today the customer must hire a firm from day one, pay for iterative design meetings, and wait days for each revision, even though the customer usually already knows what they want the layout to be.

### 1.2 Product

A browser-based drawing studio where the customer lays out the building themselves — walls, rooms, doors, windows, furniture — in 2D and walks through it in 3D. Design and 3D viewing are free and unlimited.

When the customer pays, the system generates the **architectural drawing set** as a print-accurate PDF in a real council-submission format. That set is then **reviewed by an in-house architect, who releases it** — release is what puts the file in the customer's hands, not payment. The project then routes to an in-house engineer who produces the **structural set**, and the platform merges both into one final PDF.

Two entry paths:

- **Design from scratch** — the customer draws the building in the studio.
- **Trace an existing 2D drawing** — the customer uploads a floor plan image or PDF, scales it, traces over it, and gets a 3D model plus the same generated set.

### 1.3 Professional responsibility

This bounds what the product is allowed to claim, and it is not negotiable in v1.

- **v1 delivers drawings only.** The platform produces a drawing set. That is the whole deliverable.
- **The product does not arrange a council stamp, and must not imply one.** No interface copy, marketing page, email or PDF artefact may state or suggest that the output is certified, approved, stamped, or submission-guaranteed.
- Obtaining a stamp and submitting to council remain **the customer's responsibility**.
- A partner-firm referral for stamping is a plausible later addition. It is **out of scope for v1** and must not be pre-announced.

### 1.4 Goals

| # | Goal |
|---|---|
| G-1 | A non-architect can produce a complete, dimensioned, multi-storey layout without training. |
| G-2 | The generated architectural sheets are visually and dimensionally equivalent to what a small firm produces by hand today (see §20). |
| G-3 | Printed sheets are true to scale — a 1:100 plan measures correctly on paper. |
| G-4 | Zero friction before payment: no signup wall on drawing, no export wall on 3D. |
| G-5 | The engineer's structural work is a bounded, repeatable workflow inside the platform, not an email thread. |
| G-6 | Every released set has had a human architect look at it. Quality is gated, not sampled. |

### 1.5 Non-goals (v1)

- **No stamping, certification or submission service.** See §1.3.
- No structural analysis or automated member sizing. Structural content is authored by a licensed engineer (§12).
- No MEP design. Plans carry duct/service **legends and tags** only, as in the reference set.
- No computer-vision auto-detection of uploaded drawings. Underlay tracing is manual (§7).
- No DWG/DXF import or export.
- No IFC/BIM interoperability.
- No cost estimation or bill of quantities.
- No real-time multi-user collaborative editing.
- No mobile editing (mobile is view-only).

### 1.6 Users

| User | Role |
|---|---|
| **Customer** | Homeowner or small guesthouse/shop owner. Designs, views in 3D, pays, receives the released set. Not an architect. |
| **Architect (internal)** | **Mandatory** QA reviewer on every paid project. Adjusts generated elevations and sections, signs their name into the title block, and **releases** the set. Also manages the detail library and catalogue. |
| **Engineer (internal)** | Picks up released projects, authors the S-series sheets, uploads them, approves the merge. |
| **Admin** | Pricing and fees in MVR, jurisdiction profiles, orders, refunds. |

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Project** | One building job owned by one customer. Contains the scene, metadata, underlays, orders and exports. |
| **Scene** | The single authoritative model. Both the 2D drafting view and the 3D view read and write this one graph. |
| **Node** | A data primitive in the scene — wall, slab, door, window, item, zone, grid line, dimension. |
| **Level** | A storey (Ground, First, Second, Terrace, Roof) with a floor-to-floor height. |
| **Zone** | An enclosed space with a name and a computed area — becomes a room tag on the plan. |
| **Sheet** | One page of the output PDF, e.g. `A.01 Ground Floor Plan`. |
| **Sheet Set** | The ordered collection of sheets defined by a jurisdiction profile. |
| **Jurisdiction Profile** | Config defining page size, title block, stamp reserve, sheet codes, scales, units and the required-sheet list for a market. |
| **Title Block** | The right-hand band on every sheet carrying firm, project, personnel, client, date, scale and sheet number. |
| **Stamp Reserve** | A blank 2-inch × 2-inch region in the lower-left of every sheet, left clear for the council's physical stamp. |
| **Underlay** | A raster or PDF image placed behind a level, scaled to real-world units, used as a tracing guide. |
| **Export Job** | An async server-side task that renders a sheet set to PDF. |
| **QA Queue** | The list of paid projects awaiting mandatory architect review. |
| **Structural Queue** | The list of released projects awaiting engineer structural work. |
| **Release** | The architect's explicit act of approving a reviewed set. The sole unlock for the clean PDF. |
| **Sheet Override** | A QA-authored adjustment to a generated sheet's labels, level lines or cropping, stored on the project and never written back into the scene. |
| **Detail Library** | Fixed standard construction details that populate sheets `A.09`–`A.13`. Project finishes swap a few callout labels only. |

---

## 3. User Journeys

### 3.1 Customer designs from scratch

1. Opens the studio, starts a project, enters project name, location and plot dimensions.
2. Draws the plot boundary, then walls on the Ground level. Rooms auto-close and report their area.
3. Places doors and windows; each gets an auto-assigned type tag (`D01`, `W01`…) and the running count updates.
4. Adds furniture and sanitary fixtures from the catalogue.
5. Adds a First level; copies the Ground walls as a starting point; edits.
6. Switches to 3D, walks through at eye level, adjusts, renders an image. **All free, unlimited.**
7. Requests the drawing set. Sees a **watermarked preview** of every sheet, immediately and free.
8. Pays once for this project. Status becomes `In architect review` — **no file yet**. The expected turnaround is shown.
9. An in-house architect reviews the generated sheets, adjusts the elevations and sections, writes their name into the title block, and **releases**. The customer is notified and downloads the clean architectural PDF (`A.00`–`A.13`).
10. Project passes to the engineer. Customer is notified again when the merged architectural + structural PDF is ready.
11. The customer takes that set to council themselves. The platform has not stamped it and never said it would (§1.3).

### 3.2 Customer traces an existing drawing

1. Starts a project, uploads a JPG/PNG/PDF of their existing floor plan.
2. Assigns it to the Ground level, clicks two points on a dimension they know the real length of, types that length. The image scales to real-world units.
3. Locks the underlay, sets opacity, traces walls over it. Places doors, windows, furniture.
4. Repeats per floor with one underlay per level.
5. Continues from step 6 of §3.1.

### 3.3 Architect reviews and releases

1. Opens the QA queue, sees paid projects awaiting review with age against the turnaround target.
2. Assigns a project to themselves.
3. Pages through every generated sheet against the model.
4. On the elevations and sections, adjusts labels, level-line positions and cropping. These are stored as **sheet overrides** — the scene itself is untouched.
5. Writes their own name into the title block's **architect** and **architectural checker** fields, which were blank until now.
6. **Releases.** Only this unlocks the clean architectural PDF. The customer is notified.
7. If the layout is unbuildable rather than merely untidy, sends it back to the customer with notes instead of releasing.

### 3.4 Engineer completes the structural set

1. Opens the structural queue, sees **released** projects with status and age.
2. Assigns a project to themselves.
3. Downloads the architectural PDF **and** the internal machine-readable model export (geometry, grid, levels, wall thicknesses, loads-relevant metadata).
4. Authors `S.01`–`S.12` externally in the same sheet template.
5. Fills the title block's **engineer** and **structural checker** fields.
6. Uploads the S-series PDF. The platform validates page size and sheet codes against the profile.
7. Marks approved. Platform merges A + S into one final PDF, notifies the customer, and writes an audit entry.

---

## 4. Functional Requirements — 2D Drafting (`FR-1x`)

| ID | Requirement |
|---|---|
| **FR-10** | Draw walls by clicking a polyline, with ortho lock, endpoint/midpoint/intersection snapping, and live length readout. |
| **FR-11** | Edit walls after creation: drag endpoints, split, join, delete, change thickness. Connected walls stay connected. |
| **FR-12** | Wall thickness presets configurable per project, with the reference set's values as defaults: 150mm solid block + 25mm plaster external; 100mm internal partition. Thickness is stored in mm. |
| **FR-13** | Closed wall loops auto-detect as **zones**. Each zone has a user-editable name and an auto-computed floor area displayed in m². |
| **FR-14** | Place doors and windows into walls. Each instance references a **type** (`D01`…`D08`, `W01`…`W02`); types carry width × height and a symbol. Placement cuts the wall opening in both 2D and 3D. |
| **FR-15** | Type tags auto-assign on first use of a new size, and instance counts per type are maintained live — these counts are the `Quantity` column of the door/window schedules (`FR-505`, `FR-506`). |
| **FR-16** | Place stairs with configurable rise/going/width; stairs generate a plan symbol with UP/DOWN arrows and numbered treads, and a stair void on the level above. |
| **FR-17** | Multiple levels per project, each with a name and floor-to-floor height (default 3000mm). Levels are orderable. Support Ground, First, Second, Terrace, Roof as the default ladder. |
| **FR-18** | Copy a level's geometry to a new level as a starting point. |
| **FR-19** | Draw structural grid lines. Vertical grids label `A, B, C…`; horizontal grids label `1, 2, 3…`. Bubbles render at both ends. Grid position is shared across all levels. |
| **FR-1A** | Dimension strings: a running chain between grid lines plus an overall dimension, on each of the four sides. Auto-generated from grids and wall extents, with manual override. |
| **FR-1B** | All lengths display **dual units — millimetres on the first line, `[ft'-in"]` bracketed beneath** — per the jurisdiction profile (`FR-62`). |
| **FR-1C** | Place section lines on a plan; each defines an elevation/section viewport (`FR-504`) and renders a section marker with a sheet cross-reference. |
| **FR-1D** | Draw the plot boundary and the road edge as site-plan geometry. Plot area and building footprint area compute automatically. |
| **FR-1E** | Undo/redo across all editing operations, minimum 50 steps. |
| **FR-1F** | Autosave continuously; project is never lost on browser close or crash. |

---

## 5. Functional Requirements — Furniture & Fixtures (`FR-2x`)

| ID | Requirement |
|---|---|
| **FR-20** | A catalogue browsable and searchable by category. v1 categories, derived from the reference plans: **Beds & bedroom** (single, double, wardrobe, bedside), **Seating** (sofa, armchair, stool), **Dining** (table + chair sets), **Kitchen** (counter, sink, cooker, fridge), **Sanitary** (WC, wash basin, shower, bath), **Storage**, **Misc** (stair, planter). |
| **FR-21** | Drag an item onto the plan. It snaps to the floor and, where appropriate, to walls with correct back-to-wall orientation. |
| **FR-22** | Move, rotate (free and 15° snapped) and mirror placed items. Scale only where the catalogue entry permits it. |
| **FR-23** | Collision feedback: an item overlapping a wall or another item is visually flagged. Placement is **not** blocked — the customer decides. |
| **FR-24** | Each catalogue entry carries a name, real-world bounding dimensions, a **2D plan symbol** (vector) and a **3D mesh**. The 2D symbol is what appears on generated plans — never a projection of the mesh. |
| **FR-25** | A furniture/fixture schedule is derived from placed items: name, dimensions, quantity, per level. |
| **FR-26** | Items belong to a level and move with it. |

---

## 6. Functional Requirements — 3D View (`FR-3x`)

| ID | Requirement |
|---|---|
| **FR-30** | The 3D view renders the **same scene graph** as the 2D view. There is exactly one model. An edit in either view is immediately visible in the other. This is a hard architectural constraint, not a preference. |
| **FR-31** | Orbit / pan / zoom navigation. |
| **FR-32** | First-person walkthrough at configurable eye height (default 1600mm), with collision against walls. |
| **FR-33** | Section cut — a movable plane that cuts the model, for inspecting interiors. |
| **FR-34** | Exploded view — separate levels vertically to show the stack. |
| **FR-35** | Level isolation — show/hide individual levels. |
| **FR-36** | Material assignment per surface class (external wall, internal wall, floor, ceiling, roof) from a finishes palette. The selected finishes feed the plan finishing-notes block (`FR-502`) and a small fixed set of **callout labels** on the detail sheets (`FR-507`–`FR-510`) — floor finish and wall tile. They do not redraw those sheets. |
| **FR-37** | Daylight control — time of day and sun orientation, with a North direction set per project. |
| **FR-38** | Render the current 3D camera to a downloadable image. Free and unwatermarked (it is not a deliverable sheet). |
| **FR-39** | Doors are interactive — click to open/close in the 3D view. |

---

## 7. Functional Requirements — 2D Underlay Import (`FR-4x`)

| ID | Requirement |
|---|---|
| **FR-40** | Upload JPG, PNG or a single-page selection from a PDF, max 25 MB, and assign it to one level. |
| **FR-41** | **Two-point scale calibration:** the user clicks two points on the image and enters the real-world distance between them. The image is scaled to real units. Calibration is re-runnable. |
| **FR-42** | Position controls: translate, rotate (free and 90° snapped), flip. |
| **FR-43** | Opacity slider and a lock toggle. A locked underlay cannot be selected or moved by drafting operations. |
| **FR-44** | One underlay per level; multiple levels each carry their own. Underlays align to a shared project origin so floors stack correctly. |
| **FR-45** | Underlays are **never** included in generated output sheets. They are a drafting aid only. |
| **FR-46** | Uploaded files are private to the project owner and internal staff assigned to the project. |

---

## 8. Functional Requirements — Drawing Set Generation (`FR-5x`)

> This is the core of the product and the hardest part. See §16 for the risk.

### 8.1 Derivation principle

| ID | Requirement |
|---|---|
| **FR-500** | Every 2D sheet is produced by **deriving orthographic vector geometry from the scene graph** — plan cuts, elevation projections, section cuts — with correct CAD line weights, line types and hatch patterns. Sheets are **never** raster screenshots of the 3D view. |

### 8.2 Sheets

Each row states the source data and required content. Sheet codes follow the Maldives profile (§9).

| Sheet | ID | Content |
|---|---|---|
| **A.00 Site Plan** | **FR-501** | Plot boundary (chain-dash), hatched proposed footprint, road edge, North arrow, overall plot dimensions, a project-details block (location, plot area, footprint area, building height, plot name, building type), and a legend (plot boundary line / proposed plot area / road). Areas computed from `FR-1D`. |
| **A.01–A.04 Floor Plans** | **FR-502** | One sheet per level at 1:100. Grid bubbles and grid dimension chains; running + overall dimensions all four sides; walls cut and poché'd; door and window symbols with type tags; zone name tags; furniture 2D symbols; stairs; the **finishing-notes block**; the **service-duct legend** (PD plumbing / ED electrical / ND networking / floor drain / block masonry wall); section markers; scale note; North arrow. |
| **A.05–A.06 Elevations** | **FR-503** | One sheet per facade at 1:100. Orthographic projection of the building envelope with openings, balconies and railings. Right-hand **level line stack** — Foundation Level, NGL, Ground Floor Level, First Floor Level, Terrace Floor Level, Roof Slab Level — with floor-to-floor dimensions and a bracketed total height. **Generated automatically.** Labels, level-line positions and cropping are adjustable by the QA architect only (`FR-602`); the customer never edits this sheet. |
| **A.07 Sections** | **FR-504** | One sheet per user-placed section line at 1:100. Cut through slabs, walls, stairs and foundation; hatched earth below NGL; same level line stack and total-height dimension as elevations. **Generated automatically**, with the same QA-only adjustment rule as `FR-503`. |
| **A.08 Door Schedule** | **FR-505** | Auto-derived table. Columns: Element ID, Quantity, W × H size, 2D Symbol, 3D Back View. One column per door type; quantity from live instance counts (`FR-15`). |
| **A.08a Window Schedule** | **FR-506** | Identical structure for window types. |
| **A.09 Stair Detail** | **FR-507** | Stair plan detail at 1:50 with numbered treads, UP/DOWN and a rise × going callout, generated from the placed stair (`FR-16`). |
| **A.10–A.11 Ceiling Details** | **FR-508** | **Fixed library drawings.** Gypsum ceiling section, gypsum on aluminium frame, framing axonometric, hanger and connection details. Not derived from the model. |
| **A.12 Toilet & Wash Basin Details** | **FR-509** | **Fixed library drawings.** Typical toilet section at 1:20 and wash basin detail at 1:20. The only project-specific content is a small set of **callout labels** swapped from the project's finishes (`FR-36`) — floor finish, wall tile. The geometry is never redrawn. |
| **A.13 AC & Flooring Details** | **FR-510** | **Fixed library drawings.** AC outdoor-unit connection detail and typical flooring build-up detail, with the same callout-label rule as `FR-509`. |
| **Area / Finishes Schedule** | **FR-511** | Per-level table of zones, areas and assigned finishes. Included when the profile requires it. |

### 8.3 Page furniture, applied to every sheet

| ID | Requirement |
|---|---|
| **FR-520** | **Title block** on the right band of every sheet, populated from project metadata: firm logo and name, project name, drawing title, architect, architectural checker, engineer, structural checker, client, date, project no., scale, drawing no., and a large sheet no. The four **personnel fields stay blank** until a human writes them: *architect* and *architectural checker* at QA release (`FR-603`), *engineer* and *structural checker* on structural upload (`FR-83`). A watermarked preview renders them blank. |
| **FR-521** | **Stamp reserve** — a dashed 2-inch × 2-inch region in the lower-left of every sheet with the standard caption, kept clear of all drawing content. Layout must guarantee no geometry intrudes. |
| **FR-522** | Sheet numbering and ordering per the profile's sheet list; codes appear in both the title block and the PDF bookmarks. |

### 8.4 Export

| ID | Requirement |
|---|---|
| **FR-530** | Generation runs as an async **export job** with queued / running / done / failed states and a progress indicator. |
| **FR-531** | **Watermarked preview** of the full set is generated free, at any time, before payment. Watermark must not be removable client-side — it is applied server-side. |
| **FR-532** | The clean PDF is released only when **both** conditions hold: a settled payment (`FR-73`) **and** an architect release (`FR-604`). Payment alone is not sufficient. |
| **FR-533** | Output is a single multi-page PDF with vector geometry and embedded fonts, plus optional per-sheet PDFs. |
| **FR-534** | **Print accuracy:** a sheet declared 1:100 must measure true when printed at 100% on the profile's page size. This is verified by an automated check (§18). |
| **FR-535** | **Determinism:** the same scene exported twice produces geometrically identical sheets. |

---

## 9. Functional Requirements — Jurisdiction Profile (`FR-6x`)

| ID | Requirement |
|---|---|
| **FR-60** | A **jurisdiction profile** is a versioned configuration object, not hard-coded logic. It defines: page size and orientation; title-block geometry and field list; stamp-reserve geometry and caption; sheet-code scheme; the ordered required-sheet list; default scales per sheet type; unit display rules; and the level-naming ladder. |
| **FR-61** | The **Maldives profile** ships as the single v1 implementation, matching the reference set: right-hand title block with the field list in `FR-520`, dashed 2in × 2in lower-left stamp reserve, `A.nn` architectural and `S.nn` structural codes, 1:100 plans / 1:50 schedules and stair / 1:20 details. |
| **FR-62** | Unit display is profile-driven. The Maldives profile specifies **dual mm + `[ft'-in"]`**. |
| **FR-63** | Adding a second profile must require **no change to the sheet-composition engine** — only a new profile definition and, where needed, new title-block and detail templates. |
| **FR-64** | A project is bound to one profile at creation; changing it triggers a re-export. |

---

## 10. Functional Requirements — Accounts, Projects, Payment (`FR-7x`)

| ID | Requirement |
|---|---|
| **FR-70** | Email sign-up / sign-in. A visitor may start drawing **before** signing in; the first save prompts for an account and carries the work over. |
| **FR-71** | Project list, create, rename, duplicate, archive, delete. Per-project metadata: project name, client name, location, plot name, building type, date. These populate the title block (`FR-520`). |
| **FR-72** | Version history with named restore points, plus automatic snapshots. Restoring never destroys a later version. |
| **FR-73** | **One-time payment per project**, charged in **Maldivian rufiyaa (MVR)**, in the mid band of roughly **4,600–12,300 MVR**. The exact figure is an admin setting (`FR-93`), not a constant in code. Payment moves the project into architect QA; it does **not** by itself release any file (`FR-532`). Design, 3D and watermarked preview stay free and unlimited. |
| **FR-74** | Released projects allow **unlimited re-export and re-download** of the architectural set at no further charge. Re-export reapplies the stored QA sheet overrides (`FR-Q2`). |
| **FR-75** | Editing a released project is allowed, and **re-export is included at no further charge** — *unless* the edit crosses the **re-review threshold**, which is: (a) **adding or removing a storey**, or (b) **changing the building footprint** beyond a small configured tolerance. Crossing it returns the project to the engineer (`FR-87`) and charges a separate **re-review fee** in MVR, an admin setting (`FR-93`). The customer is warned and must confirm the charge **before** the edit is committed — never billed by surprise. Sub-threshold edits (moving internal partitions, swapping furniture, renaming rooms, changing finishes) never trigger a fee. |
| **FR-76** | Receipts and an order history per account. |
| **FR-77** | Payment is handled by a hosted third-party provider. **No card data reaches our servers.** Payment state is confirmed server-side via webhook, never trusted from the client. |
| **FR-78** | The customer sees project status throughout: `Designing → Paid → In architect review → Released (architectural set available) → Structural in progress → Complete`. `In architect review` shows the turnaround target (`FR-Q7`); a project returned for changes (`FR-Q5`) shows `Changes requested` with the reviewer's notes. |
| **FR-79** | The customer downloads the **merged final PDF** (architectural + structural) once the engineer approves (`FR-85`). |

---

## 11. Functional Requirements — Architect QA Gate (`FR-Qx`)

> Mandatory on **every** paid project. This gate, not payment, is what releases the clean PDF.

| ID | Requirement |
|---|---|
| **FR-Q0** | Every paid project enters architect QA. There is **no sampling, no auto-release and no bypass**, including for repeat customers. A project cannot reach the customer's downloads without passing through here. |
| **FR-Q1** | A **QA queue** listing paid projects awaiting review, with payment date, age, and age measured against the turnaround target (`FR-Q7`). Sortable and filterable. A reviewer assigns a project to themselves; assignment is visible to other staff to prevent duplicate work. |
| **FR-Q2** | The reviewer may adjust generated **elevations and sections** (`FR-503`, `FR-504`): label text and position, level-line positions and labels, and viewport cropping. Adjustments are stored as **sheet-level overrides on the project** — they must **not** mutate the scene graph, and they must survive a later re-export (`FR-74`). Overrides are per sheet and individually revertible. |
| **FR-Q3** | The reviewer writes the **architect** and **architectural checker** names into the title block (`FR-520`). Both are required before release. The *engineer* and *structural checker* fields are **not** filled here — the engineer fills them on upload (`FR-83`), because no engineer is assigned yet at QA time. |
| **FR-Q4** | **Release** is an explicit reviewer action and the sole unlock for the clean architectural PDF (`FR-532`). Release is blocked until `FR-Q3` is satisfied. |
| **FR-Q5** | The reviewer may instead **return the project to the customer** with notes, for layouts that are unbuildable rather than merely untidy. The customer edits and resubmits at no additional charge; the project re-enters the QA queue. |
| **FR-Q6** | Every QA action — assignment, each override, names written, release or return — is written to the project audit trail (`FR-86`). |
| **FR-Q7** | A **turnaround target** for QA is configured by admin and shown to the customer at the point of payment and on the project status. Breaching it flags the project in the queue. |
| **FR-Q8** | The customer **cannot** edit elevations, sections or any other generated sheet directly, before or after release. Their only lever is the model plus, where applicable, a return-for-changes cycle (`FR-Q5`). |

---

## 12. Functional Requirements — Engineer Review Workflow (`FR-8x`)

| ID | Requirement |
|---|---|
| **FR-80** | A **structural queue** listing **released** projects with status, release date and age. Sortable and filterable. |
| **FR-81** | An engineer assigns a project to themselves; assignment is visible to other staff to prevent duplicate work. |
| **FR-82** | The engineer downloads (a) the generated architectural PDF and (b) a **machine-readable model export** — levels and heights, grid definition, wall centrelines and thicknesses, slab outlines, opening positions, stair geometry, and project metadata — in a documented JSON schema. This export is **internal in v1** — available to assigned staff only. A customer-facing download is a possible later addition and must not be exposed or advertised in v1. |
| **FR-83** | The engineer uploads the completed S-series PDF. The platform **validates** page size, page count and sheet codes against the profile, and rejects a mismatch with a specific error. |
| **FR-84** | Structural sheets are stored as an engineer-authored artefact and are **never** regenerated or altered by the platform. |
| **FR-85** | On approval the platform **merges** A + S into one ordered final PDF with bookmarks, and notifies the customer. |
| **FR-86** | A per-project **audit trail**: who assigned, who uploaded, what file, when, and every status transition. Immutable. |
| **FR-87** | If the customer's post-release edits cross the re-review threshold (`FR-75`) and the re-review fee is paid, the project returns to the structural queue flagged `Re-review` with a diff summary of what changed. It also re-enters architect QA (`FR-Q0`), since the regenerated sheets have not been reviewed. |

---

## 13. Functional Requirements — Admin (`FR-9x`)

| ID | Requirement |
|---|---|
| **FR-90** | Catalogue management: add/edit/retire furniture entries with 2D symbol, 3D mesh, dimensions and category. |
| **FR-91** | Detail-library management: add/edit standard details and define which finish parameters they read. |
| **FR-92** | Jurisdiction-profile management: create, edit and version profiles; preview a profile against a sample project. |
| **FR-93** | Pricing configuration per profile/market, denominated in **MVR**: the per-project price (`FR-73`), the **re-review fee** (`FR-75`), and the QA turnaround target (`FR-Q7`). Changing a price never alters the amount already charged on an existing order. |
| **FR-94** | Order, refund and export-job visibility, including failed jobs with their error. |
| **FR-95** | Staff role management: architect, engineer, admin. |

---

## 14. Non-Functional Requirements

| ID | Requirement |
|---|---|
| **NFR-1** | **Browsers:** current Chrome, Edge, Safari and Firefox on desktop. WebGPU where available with a **WebGL2 fallback**; the studio must remain usable without WebGPU. |
| **NFR-2** | **Mobile:** view-only 3D and PDF download. Editing is desktop-only in v1. |
| **NFR-3** | **Interactive performance:** ≥ 30 fps orbiting a 3-storey project of ~2,000 nodes on mid-range integrated graphics. |
| **NFR-4** | **Edit latency:** a wall edit reflects in the 3D view within 100 ms. |
| **NFR-5** | **Export time:** a full 14-sheet architectural set completes within 60 s p95. |
| **NFR-6** | **Print accuracy:** dimensional error on a printed 1:100 sheet ≤ 0.5 mm on paper (`FR-534`). |
| **NFR-7** | **Durability:** autosave at most 5 s of work at risk; local persistence survives a crash; server is the authority once signed in. |
| **NFR-8** | **Privacy and retention:** uploaded drawings and project data are visible only to the owner and to internal staff assigned to that project. Data is retained **until the customer deletes it** — there is **no automatic expiry in v1** for uploads or archived projects. Deletion by the customer is honoured for their own content; released deliverables and audit records are retained as required for the order. |
| **NFR-9** | **Payments:** PCI scope minimised — hosted provider, no card data stored or transited by us. |
| **NFR-10** | **Security:** authenticated, authorised access on every project and export endpoint. Export downloads use signed, expiring URLs. |
| **NFR-11** | **Accessibility:** keyboard navigation for all non-canvas UI, WCAG AA contrast, visible focus states. |
| **NFR-12** | **Observability:** export jobs are logged with duration, outcome and error; failures alert staff. |
| **NFR-13** | **Determinism:** geometry derivation is free of nondeterministic ordering (`FR-535`). |

---

## 15. Technical Approach

### 14.1 Base platform

Build on **[pascalorg/editor](https://github.com/pascalorg/editor)** (MIT). Per its README, it already provides:

- Turborepo + Bun monorepo; **Next.js 16 / React 19** host app
- **Three.js with the WebGPU renderer** via React Three Fiber + Drei
- **Zustand** scene store with **Zundo** (50-step undo/redo) and IndexedDB persistence
- **Zod** node schemas; flat node dictionary with `parentId` hierarchy — `Site → Building → Level → Zone → Items`
- Dirty-node **systems** in the frame loop: WallSystem (mitering and cutouts), SlabSystem, CeilingSystem, RoofSystem, ItemSystem
- **three-bvh-csg** for boolean door/window cutouts
- A **Registry** mapping node IDs to Three.js objects, a typed **event bus** (mitt), and a spatial grid manager for placement validation
- Tools: Select, Wall, Zone, Item, Slab
- A **plugin manifest** — the project's stated guidance is that new node kinds ship as plugins rather than core edits

This covers a large share of `FR-1x`, `FR-2x` and `FR-3x`. Our additions follow the plugin convention.

### 14.2 What must be built

| Layer | Work |
|---|---|
| **2D drafting view** | A true orthographic drafting canvas bound to the same Zustand store as the 3D view, with CAD-grade snapping, ortho lock and selection. |
| **New node kinds** (as plugins) | Grid line, dimension string, section line, text annotation, plot boundary, underlay. |
| **Underlay** | Image/PDF placement, two-point scale calibration, lock and opacity. |
| **Drawing-derivation layer** | The critical new subsystem. Projects the node graph to orthographic **vector** geometry — plan cuts at a cut height, elevation projections with hidden-line removal, section cuts — assigning CAD line weights, line types and hatch patterns. Output is a scene-independent vector representation. |
| **Sheet-composition engine** | Places derived viewports on a page at a declared scale, draws the title block and stamp reserve, lays out schedules, notes blocks and legends, per the jurisdiction profile. |
| **PDF output** | Vector **SVG → PDF** with embedded fonts and correct physical page dimensions. |
| **Export worker** | Server-side headless job runner for preview and clean exports, plus the A+S merge. |
| **Backend** | Auth, projects, versions, uploads, orders/webhooks, review queue, audit trail, admin. |
| **Schedules** | Derive door/window/furniture/area tables from live instance counts. |
| **Detail library** | Parameterised standard-detail templates keyed to finish selections. |

### 14.3 Key decisions

- **One model, two views.** The 2D and 3D views are projections of the same node graph (`FR-30`). No second geometry pipeline.
- **Vector, not raster.** Sheets are derived vector geometry (`FR-500`). This is what makes `NFR-6` achievable.
- **Profile-driven sheets.** No sheet layout is hard-coded; everything reads the jurisdiction profile (`FR-60`).
- **Structural is human-authored.** The platform never generates structural content (`FR-84`).

---

## 16. Risks

| # | Risk | Mitigation |
|---|---|---|
| **R-1** | **Drawing-derivation fidelity.** The generated `A.01` may not look like a draughtsman's `A.01` — line weights, poché, symbol conventions and dimension placement are where hand-drawn sets earn their credibility. This is the single largest technical risk. | Make M2 (§17) prove exactly this against the reference `A.01` before any other sheet is attempted. Architect QA pass in the loop. |
| **R-2** | **Print-scale correctness.** Off-by-a-fraction scaling makes the set useless for submission. | Automated physical-measurement check in CI (§18). |
| **R-3** | **Council acceptance.** A generated set may be rejected for a convention we did not replicate. | Validate an end-to-end set against council expectations before launch; architect sign-off gate. |
| **R-4** | **Implied certification.** The product delivers drawings only (§1.3), but customers may assume a purchased, architect-reviewed set is council-ready — and a salesperson or a piece of UI copy may drift into implying it. The exposure is reputational and legal. | Drawings-only position stated in-product at the point of payment and on delivery; copy audit before launch and before any marketing push (§18); no stamping partner referred to until one genuinely exists. |
| **R-5** | **Non-architect input quality.** Customers will produce layouts that are dimensionally valid but practically unbuildable. | Collision and clearance warnings (`FR-23`); the mandatory QA gate (`FR-Q0`) with a return-for-changes path (`FR-Q5`). |
| **R-6** | **Human throughput.** There are now **two** mandatory human steps — architect QA and engineer structural. Together they set delivery time, and both scale with headcount, not code. | Queue visibility and ageing on both (`FR-Q1`, `FR-80`); measure turnaround from day one; the QA turnaround target (`FR-Q7`) is a commitment to watch, not a hope. |

---

## 17. Phasing

| Milestone | Scope | Exit criterion |
|---|---|---|
| **M1 — Editor & 3D** | `FR-1x`, `FR-2x`, `FR-3x`, `FR-4x`, `FR-70`–`FR-72`, `NFR-1`–`NFR-4`, `NFR-7` | A user can draw a 3-storey building with furniture from scratch **or** by tracing an uploaded plan, and walk through it in 3D. |
| **M2 — Sheet engine** | `FR-500`, `FR-502`, `FR-520`–`FR-522`, `FR-533`–`FR-535`, `FR-60`–`FR-62`, `NFR-6`, `NFR-13` | A generated `A.01 Ground Floor Plan` is placed side by side with the reference sheet and judged equivalent by an architect, **and** measures true at 1:100 when printed. |
| **M3 — Full set, payment & QA gate** | `FR-501`, `FR-503`–`FR-511`, `FR-530`–`FR-532`, `FR-63`, `FR-64`, `FR-73`–`FR-78`, `FR-Qx`, `FR-9x`, `NFR-5`, `NFR-8`–`NFR-10`, `NFR-12` | A customer pays in MVR, an architect reviews and releases, **and only then** the customer downloads a complete, clean `A.00`–`A.13` PDF. An unreleased paid project yields no file. |
| **M4 — Engineer loop** | `FR-79`, `FR-8x`, `NFR-11` | An engineer takes a **released** project from the structural queue, uploads `S.01`–`S.12`, approves, and the customer downloads one merged final PDF. |

Every `FR-` and `NFR-` above appears in exactly one milestone. The QA gate lands in **M3**, not M4, because it blocks paid release — M3 is not shippable without it.

---

## 18. Verification

| Check | How |
|---|---|
| **Visual fidelity** | Side-by-side of each generated sheet against its reference in `samplephotos/` (§20), reviewed by an architect. Gate for M2 and M3. |
| **Print scale** | Automated: export a known-geometry test project, parse the PDF, assert that a 10,000mm wall measures 100.0mm ± 0.5mm on a 1:100 sheet (`NFR-6`). |
| **Schedule correctness** | Automated: place a known mix of door/window instances, export, assert schedule quantities match placed counts (`FR-15`, `FR-505`, `FR-506`). |
| **Determinism** | Automated: export the same scene twice, assert identical derived geometry (`FR-535`). |
| **Stamp reserve** | Automated: assert no ink falls inside the reserve rectangle on any sheet (`FR-521`). |
| **Model/view parity** | Automated: mutate a wall via the 2D view, assert the 3D geometry updates (`FR-30`). |
| **Payment gating** | Automated: assert clean-PDF endpoints reject unpaid projects and that watermarking is server-side (`FR-531`, `FR-532`). |
| **Release gating** | Automated: a **paid but unreleased** project must yield no clean PDF from any endpoint; release without both architect names set must be rejected (`FR-Q0`, `FR-Q3`, `FR-Q4`, `FR-532`). |
| **QA overrides survive re-export** | Automated: apply sheet overrides, re-export, assert the overrides persist and that the scene graph is byte-identical before and after (`FR-Q2`, `FR-74`). |
| **Re-review threshold** | Automated: a sub-threshold edit re-exports free; adding a storey or breaching footprint tolerance requires explicit fee confirmation before commit (`FR-75`, `FR-87`). |
| **Title-block blanks** | Automated: a watermarked preview renders all four personnel fields blank; a released set has the architect pair filled; a merged final set has all four (`FR-520`, `FR-Q3`, `FR-83`). |
| **No implied certification** | Manual copy audit before launch and before any marketing push: no interface string, email, or PDF artefact claims the output is stamped, certified, approved or submission-guaranteed (§1.3, `R-4`). |
| **Retention** | Automated: no scheduled job expires uploads or archived projects; customer deletion removes their content (`NFR-8`). |
| **Profile additivity** | Add a throwaway second profile; assert it renders without touching the composition engine (`FR-63`). |
| **End-to-end** | Walk §3.1, §3.2, §3.3 and §3.4 manually before each release. |

---

## 19. Decisions & Open Items

### 19.1 Decisions taken

All nine questions raised in the first draft are now settled. Recorded here so the reasoning is not lost.

| # | Question | Decision | Encoded in |
|---|---|---|---|
| **D-1** | Price point and currency? | One per-project price in **MVR**, mid band ≈ **4,600–12,300**. Exact figure is an admin setting. | `FR-73`, `FR-93` |
| **D-2** | Do elevations and sections need manual adjustment? | **Generated automatically.** The QA architect may adjust labels, level lines and cropping. The customer never edits them. | `FR-503`, `FR-504`, `FR-Q2`, `FR-Q8` |
| **D-3** | What triggers engineer re-review, and is it charged? | **Adding a storey, or footprint change past a small tolerance.** Re-review is **paid**, fee set by admin in MVR. Sub-threshold re-export stays free. | `FR-75`, `FR-87`, `FR-93` |
| **D-4** | Are detail sheets parameterised or boilerplate? | **Fixed library drawings.** Finishes swap a few callout labels only (floor finish, wall tile). | `FR-507`–`FR-510`, `FR-36` |
| **D-5** | Who fills the title-block names? | Blank until a human writes them. Architect + architectural checker at QA; engineer + structural checker on structural upload. | `FR-520`, `FR-Q3`, `FR-83` |
| **D-6** | Data retention period? | **No automatic expiry in v1.** Uploads and archived projects persist until the customer deletes them. Access limited to owner and assigned staff. | `NFR-8` |
| **D-7** | Who signs and stamps for council? | **Nobody, on our side.** v1 delivers drawings only; the product does not arrange a stamp and must not imply one. Partner referral is a possible later addition. | §1.3, §1.5, `R-4` |
| **D-8** | Is architect QA mandatory or sampled? | **Mandatory on every paid project**, and it is the gate that releases the clean PDF. | §11 (`FR-Q0`–`FR-Q8`) |
| **D-9** | Is the JSON model export customer-facing? | **Internal in v1** — engineer use only. Customer download is a possible later addition. | `FR-82` |

### 19.2 Still open

Neither blocks starting work; both are values rather than design questions.

| # | Item |
|---|---|
| **OQ-1** | The exact per-project price and the exact re-review fee, in MVR, within the agreed band (`FR-73`, `FR-93`). |
| **OQ-2** | The QA turnaround target to commit to publicly (`FR-Q7`). Needs a measured QA cycle time before it can be promised — set it after the first real projects, not before. |

### 19.3 Consequence to be aware of

The mandatory QA gate means **payment no longer produces an instant download**. This is a deliberate trade of speed for quality (G-6), but it changes the product's felt promise: the customer pays and then waits on a human. Three things follow, and all are already requirements — the turnaround target must be shown *before* the customer pays (`FR-Q7`), the status ladder must make the wait legible (`FR-78`), and the free watermarked preview must be good enough that paying feels safe (`FR-531`). If QA turnaround drifts, this is the first thing customers will complain about.

---

## 20. Appendix — Reference Set Inventory

The 28 sheets in `samplephotos/`. Project: **Everglow**, a 3-storey commercial building at K.Thulusdhoo, Maldives, by **ARTEFACT (Architects, Planners & Engineers)**, dated 23-09-2026. This is the target output.

**Gen.** = Auto-generated by the platform · **Lib.** = From the detail library · **Eng.** = Engineer-authored

| Sheet | Title | Source | File in `samplephotos/` |
|---|---|---|---|
| A.00 | Site / Plot Plan | Gen. | `…12.14.32.jpeg` |
| A.01 | Ground Floor Plan 1:100 | Gen. | `…12.14.32 (1).jpeg` |
| A.02 | First–Second Floor Plan 1:100 | Gen. | `…12.14.32 (2).jpeg` |
| A.03 | Terrace Floor Plan 1:100 | Gen. | `…12.14.33.jpeg` |
| A.04 | Roof Plan 1:100 | Gen. | `…12.14.33 (1).jpeg` |
| A.05 | Elevation 1, 1:100 | Gen. | `…12.14.33 (2).jpeg` |
| A.06 | Elevation 2, 1:100 | Gen. | `…12.14.34.jpeg` |
| A.07 | Section 1:100 | Gen. | `…12.14.34 (1).jpeg` |
| A.08 | Door Schedule & Details 1:50 | Gen. | `…12.14.34 (2).jpeg` |
| A.08a | Window Schedule & Details 1:50 | Gen. | `…12.14.35.jpeg` |
| A.09 | Ground-to-Terrace Stair Detail 1:50 | Gen. | `…12.14.35 (1).jpeg` |
| A.10 | Ceiling Details — gypsum, aluminium frame, framing | Lib. | `…12.14.35 (2).jpeg` |
| A.11 | Ceiling Details — hangers, connection | Lib. | `…12.14.35 (3).jpeg` |
| A.12 | Typical Toilet Detail & Wash Basin Detail 1:20 | Lib. | `…12.14.36.jpeg` |
| A.13 | AC Connection Detail & Typical Flooring Detail | Lib. | `…12.14.36 (1).jpeg` |
| — | General Notes (structural) | Eng. | `…12.14.36 (2).jpeg` |
| S.01 | Column Layout — C1 / C2 with grid offsets | Eng. | `…12.14.37.jpeg` |
| S.02 | Foundation Layout & Foundation Pad Details | Eng. | `…12.14.37 (1).jpeg` |
| S.03 | First-to-Terrace Beam Plan 1:100 | Eng. | `…12.14.37 (2).jpeg` |
| S.04 | Typical Foundation, Column & Tie-Beam Sections | Eng. | `…12.14.37 (3).jpeg` |
| S.05 | Beam Detail — B1 / B2 midspan & support 1:20 | Eng. | `…12.14.38.jpeg` |
| S.06 | Stair Reinforcement, Footing & Railing Details | Eng. | `…12.14.38 (1).jpeg` |
| S.07 | Balcony Railing Detail 1:20 | Eng. | `…12.14.38 (2).jpeg` |
| S.08 | Well Tank Plan & Inspection Point 1:20 | Eng. | `…12.14.39.jpeg` |
| S.09 | Well Tank Section A-A 1:20 | Eng. | `…12.14.39 (1).jpeg` |
| S.10 | Standard Construction Details 1 | Eng. | `…12.14.39 (2).jpeg` |
| S.11 | Standard Construction Details 2 (BS 8110) | Eng. | `…12.14.40.jpeg` |
| S.12 | Detailed Foundation Protection Method | Eng. | `…12.14.40 (1).jpeg` |

### 19.1 Conventions observed across every sheet

- **Title block**, right-hand vertical band: firm logo; `PROJECT NAME`, `DRAWING TITLE`, `ARCHITECT`, `ARCHITECTURAL CHECKER`, `ENGINEER`, `STRUCTURAL CHECKER`, `CLIENT`, `DATE`, firm name and discipline line, `CONTACT NO`, `E-MAIL`, `PROJECT NO`, `SCALE`, `DRAWING NO`, and a large `SHEET NO`.
- **Stamp reserve**, lower-left: dashed 2-inch × 2-inch box captioned *"2-INCH X 2 INCH FROM THE BOTTOM LEFT CORNER OF EACH PAGE LEFT FOR COUNCIL STAMP"*.
- **Dual dimensions** throughout: millimetres over `[ft'-in"]`.
- **Grids**: letters `A`–`F` horizontally, numbers `1`–`4` vertically, bubbled at both ends, with running and overall dimension chains.
- **Levels**: Foundation Level, NGL, Ground Floor Level, First Floor Level, Terrace Floor Level, Roof Slab Level — 3000mm floor-to-floor, 9000mm / `[29'-6"]` total height.
- **Plan annotation blocks**: a finishing-notes list and a service-duct legend (PD / ED / ND / floor drain / block masonry wall) repeated on every floor plan.
- Scale field reads *"as Given"*; each drawing carries its own scale note beneath its title.
