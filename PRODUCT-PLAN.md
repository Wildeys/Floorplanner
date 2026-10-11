# Online Drawing Studio — Idea-to-Product Plan

**Status:** Draft v1 · **Date:** 2026-10-11 · **Repo:** `Floorplanner`
**Companions:** [REQUIREMENTS.md](REQUIREMENTS.md) · [DESIGN.md](DESIGN.md)

Format: Idea-to-Product Questionnaire. Answers are short bullets, most important first.
`Unknown – to test` marks a real gap and feeds §6. `Inapplicable` means the question does not bite here.
Update this file as evidence arrives; the checkpoint decisions are the only things that gate build work.

---

## 0. Idea Snapshot

**0.1 One sentence**
- A browser studio where a homeowner lays out their own building, and we sell the council-format architectural drawing set — generated from their model, reviewed and released by an in-house architect, then completed by an in-house engineer.

**0.2 What inspired it**
- Small jobs in the Maldives (house, guesthouse, shop fit-out) must hire a firm from day one.
- The customer usually already knows the layout they want; they pay a firm to draw what they already decided.
- Days of waiting per revision, with design meetings billed on top.
- A reference set of real council sheets exists in `samplephotos/` — the target output is a known, fixed artefact, not a guess.

**0.3 Stage now — prototype (pre-user)**
- Studio shell runs on the Pascal editor host: glass chrome, tool rail, inspector, sheet strip, 3D view (`studio/src/components/studio/`).
- Sheet pipeline works end to end for plans: derivation → pen table → true-scale PDF (`studio/src/lib/sheets/`), with tests for scale, dimensions, openings, sheet set.
- Verified: dimensions to wall centrelines, grid bubbles, hatch, door/window/furniture symbols, paper-relative annotation, 1:50 fallback for small plans.
- Not built: backend, auth, payment, architect QA queue, engineer loop, elevations, sections, details, schedules beyond openings.
- Zero customers, zero revenue, zero customer interviews.

---

## 1. The Problem

**1.1 What problem does this solve?**
- A buildable layout the owner already has in their head cannot be turned into a submission-format drawing set without engaging a firm.
- Every revision costs another firm cycle — days, and fees.
- The owner has no cheap way to see their own layout before committing money.

**1.2 Who experiences it most strongly?**
- Owners of single small buildings: a house, a guesthouse, a shop fit-out.
- Owners who are confident about the layout and resent paying for design they did not need.
- Owners on islands away from Malé, where firm access is thinner — `Unknown – to test`.

**1.3 How often does it occur?**
- Once per building, for the owner — a one-shot purchase, not a subscription.
- Continuously at market level: new small builds and fit-outs are a steady flow.
- Repeat use only via re-review after storey/footprint changes, or a second property.

**1.4 How painful or costly?**
- Money: a full firm engagement for a small job. `Unknown – to test` — need the real local quote range to put our MVR 4,600–12,300 band in context.
- Time: days per revision cycle; weeks for a set.
- Frustration: paying for design meetings to arrive at a layout the owner already had.
- Risk: without a drawing set there is no council route at all — the project simply does not start.

**1.5 Evidence the problem is real**
- A real reference council set exists and was obtained from a real job (`samplephotos/`, REQUIREMENTS §20).
- Founder-side knowledge of the local market.
- `Unknown – to test` — no customer interviews yet, no quotes collected, no count of small submissions per year. This is the weakest part of the whole plan.

**1.6 If never solved**
- Small owners keep paying firm rates for drafting.
- Self-built and informal work continues without proper sets.
- Nothing breaks; the market absorbs the cost as it does today. The problem is expensive, not urgent — so demand must be proven, not assumed.

---

## 2. The Customer

**2.1 Target customer**
- Maldives-based individual owner, roughly 30–60, building or fitting out one small property.
- Not an architect, comfortable with a laptop, not with CAD.
- Guesthouse and small-shop owners as the commercial variant.

**2.2 Who pays vs who uses**
- Same person in the base case: the owner draws and the owner pays.
- Split case: a family member or site contact draws, the owner pays — `Unknown – to test`.
- Second buyer we did not design for: small contractors who would draw on behalf of many owners. Attractive and risky — `Unknown – to test`.

**2.3 How many potential customers?**
- Maldives small-build and fit-out submissions per year: `Unknown – to test` — this number decides whether one market is a business or a pilot.
- National first, single jurisdiction profile.
- Global later, and only through new jurisdiction profiles (`FR-63`) — the engine is already profile-driven, so expansion is config plus staff, not a rewrite.

**2.4 Where to find and reach them**
- Facebook and Viber community groups where Maldivian building work is already discussed.
- Hardware suppliers, block makers, small contractors — they meet owners before any firm does.
- Island councils and permit desks, as the point where owners learn they need a set.
- `Unknown – to test` which of these actually produces a paying customer.

**2.5 Customers talked to so far**
- None. Zero interviews.
- This is the single biggest hole in the plan: a full requirements and design spec exists for a product no prospective buyer has commented on.

**2.6 First customer group**
- Owners of a single-plot house build in Greater Malé, designing from scratch.
- Chosen because it matches the reference set we can already reproduce, and because the layout is simple enough for a non-architect to finish unaided.

---

## 3. Current Alternatives and Competition

**3.1 How people solve it today**
- Hire a local architecture firm for the full engagement.
- Hire a freelance draughtsman to draw up a sketch the owner supplies.
- Reuse or copy a set from a neighbour's similar building.
- Do nothing, or build informally without a set.

**3.2 Direct competitors**
- Local Maldivian architecture and engineering firms — the real incumbent.
- Freelance draughtsmen working in AutoCAD, competing on price.
- `Unknown – to test` whether any local firm already sells a fixed-price small-house package. If one does, it is the direct comparison and our price has to answer it.

**3.3 Indirect alternatives**
- Consumer layout tools (Floorplanner, Planner 5D, SketchUp) — produce a model, not a submission set.
- Doing nothing / informal building.
- AutoCAD plus a hired hand for the owner who is technical enough.

**3.4 What customers dislike about current options**
- Price for what feels like drafting.
- Days per revision, and the meeting load.
- Paying to be designed for when they already know the layout.
- No visual of their own building until a firm produces one.
- `Unknown – to test` — this list is inferred, not heard.

**3.5 What would make them switch, and what would stop them**
- Switch: free design and free 3D with no signup, a watermarked preview of the real sheets before paying, visibly lower price, an architect's name actually on the set.
- Stop: fear that a council will reject a generated set — the decisive objection.
- Stop: we explicitly do not arrange a stamp (§1.3), so the customer still has to finish the job themselves.
- Stop: paying and then waiting on a human review rather than downloading immediately (REQUIREMENTS §19.3).
- Stop: no trust signal — new company, no completed submissions to point at.

---

## 4. The Solution

**4.1 In simple terms**
- Draw your building in the browser; walk through it in 3D; both free and unlimited.
- See every sheet of the real drawing set, watermarked, before paying.
- Pay once per project in MVR; an in-house architect reviews the generated sheets, signs the title block, and releases the clean PDF.
- An in-house engineer then authors the structural sheets, and we merge A + S into one final PDF.
- You take that set to council yourself.

**4.2 Essential for the first version**
- 2D drafting on one model with CAD snapping, plus the 3D view (M1).
- Plan sheet generation that an architect judges equivalent to the reference `A.01`, true at 1:100 on paper (M2) — the make-or-break capability.
- Underlay tracing, so an owner with an existing plan has a path in.
- Full `A.00`–`A.13` set, payment, and the mandatory architect QA gate (M3) — M3 does not ship without the gate.
- Engineer structural loop and merged final PDF (M4).

**4.3 Can wait**
- Second jurisdiction profile (the engine already supports it).
- Customer-facing JSON model export (internal only in v1, `FR-82`).
- Stamping-partner referral (out of scope and must not be pre-announced).
- Mobile editing, multi-user collaboration, DWG/IFC, cost estimation.
- Automated detection of uploaded drawings.

**4.4 Unique benefit**
- Better, not just different: the owner's own layout becomes a council-format set with an architect's review, at a fraction of a firm engagement, with revisions costing nothing.
- Consumer layout tools cannot produce a submission set; firms cannot offer free unlimited design and instant preview.
- The watermarked preview removes the usual leap of faith: you see exactly what you are buying.

**4.5 Value for money from the customer's view**
- Plausible if a firm engagement costs several multiples of our price. `Unknown – to test` — depends entirely on 1.4.
- Weakened by the drawings-only boundary: the customer still arranges the stamp.
- Strengthened by free revisions and free re-export after release (`FR-74`).

**4.6 Copyability and protection**
- No patent, no network effect, no meaningful data moat.
- Real moats: the derivation engine's fidelity to local convention (hard to get right, not hard to imagine), the jurisdiction profile as accumulated detail, and the in-house architect/engineer workflow.
- A funded competitor could rebuild this. An incumbent firm probably would not — it cannibalises their fee.
- Best protection is being first in this jurisdiction with a set councils have already accepted.

---

## ✅ Checkpoint A — Problem and Solution

- **Problem real, painful, frequent enough?** Real and expensive, evidenced only by the reference set and founder knowledge. Frequency per customer is once — this is a one-shot purchase, so market size, not retention, decides viability. Unproven.
- **Solution clearly better?** Yes on design freedom, preview, revisions and price *if* the generated sheets pass as professional and councils accept them. Both are untested.
- **Decision: Go — with the build frozen at the M2 fidelity proof.** Continue engineering only up to "architect judges `A.01` equivalent to the reference"; run the customer and council tests in §6 in parallel, and do not start M3 (payment, QA, full set) until Checkpoint B clears.

---

## 5. Key Assumptions (Hypotheses)

**5.1 Assumptions that must hold**
- A-1 A council accepts a set generated by this pipeline, with an architect's name on it, as readily as a firm's set.
- A-2 Owners will pay a one-time MVR fee in the 4,600–12,300 band for drawings-only, with the stamp still their job.
- A-3 A non-architect can finish a dimensionally sane multi-storey layout unaided (G-1).
- A-4 The derivation engine can produce sheets an architect signs their own name to.
- A-5 There are enough small submissions per year in one jurisdiction to support the business.
- A-6 Architect QA plus engineer structural work can run at a cost and turnaround that leaves a margin at that price (both scale with headcount, not code — R-6).
- A-7 Customers accept paying first and waiting on a human review (REQUIREMENTS §19.3).

**5.2 Riskiest**
- **A-1.** If councils reject the output, nothing else in the plan matters — and we control neither the decision nor the timeline. A-4 is the riskiest thing we *can* control.

**5.3 What would prove each right or wrong**
- A-1: a council officer or a submitting architect reviews a printed generated set and says it would pass; strongest proof is one real submission accepted.
- A-2: pre-orders or deposits at the stated price with the drawings-only wording shown.
- A-3: ≥7 of 10 unaided first-time users complete a two-storey layout in under 60 minutes.
- A-4: a practising architect places generated `A.01` beside the reference and judges it equivalent, and agrees to sign it.
- A-5: a counted figure for annual small submissions, sourced from council or permit data.
- A-6: measured QA and structural hours per project against the price (`FR-Q7` turnaround measured, not promised).
- A-7: pre-order conversion holds when the turnaround target is shown before payment.

**5.4 Evidence that would change direction or stop**
- Stop: a council states that a non-firm-authored set is not acceptable regardless of architect review.
- Change: architects will review but will not sign — becomes a tool sold to firms and draughtsmen, not to owners.
- Change: owners want the stamp handled, not just drawings — the business is a service with software attached, and the partner referral stops being out of scope.
- Change: non-architects cannot finish a layout — becomes a draughtsman's productivity tool.
- Stop: QA plus structural hours per project exceed the achievable price.

---

## 6. Testing and Prototype (MVP)

**6.1 Cheapest, fastest test of the riskiest assumption**
- Print the sheets we can already emit (`npm run emit:sample`, `npm run emit:room`) at true scale and put them in front of a practising local architect and a council/permit contact. Days, near-zero cost, tests A-1 and A-4 with code that already exists.

**6.2 Test types, in order**
- Expert review — printed generated sheets vs the reference set, with an architect (A-4) and a council contact (A-1).
- Interviews — 10–15 recent or prospective small-build owners on cost, revision pain and the drawings-only boundary (A-2, 1.4, 3.4).
- Landing page with the real preview and the real price, measuring deposit intent (A-2, A-7).
- Unmoderated usability runs of the existing studio shell, unaided (A-3).
- Concierge pilot — we draw one real building for one real owner by hand through our own pipeline, and support the submission (A-1 end to end, A-6 timings).

**6.3 Who tests, and how many**
- 2–3 practising architects; 1–2 council or permit-desk contacts.
- 10–15 owner interviews.
- 10 unaided usability participants.
- 1 concierge pilot project.

**6.4 What to measure**
- Architect verdict: equivalent / not equivalent, and would-sign / would-not-sign.
- Council verdict: would pass / named objections.
- Stated willingness to pay, and deposits actually taken.
- Unaided layout completion rate and time.
- QA hours and structural hours on the pilot.

**6.5 Numeric success bars**
- ≥2 of 3 architects judge `A.01` equivalent **and** would sign.
- Zero council objections that the pipeline cannot fix in the profile.
- ≥5 of 15 interviewees state the price is acceptable; ≥3 paid deposits.
- ≥7 of 10 unaided users finish a two-storey layout under 60 minutes.
- Pilot QA under 3 hours per project.

**6.6 Time and money**
- Expert reviews and interviews: ~3 weeks, printing and travel only.
- Landing page: ~1 week on top of existing components.
- Usability runs: ~1 week.
- Concierge pilot: 4–8 weeks, gated on a willing owner and the engineer's time.

**6.7 Results and learning**
- Not yet run. Fill in per test as results arrive; record what the architect and council objections actually were, verbatim.

---

## ✅ Checkpoint B — Evidence

- **Did tests support the assumptions?** No tests have been run. Nothing to support.
- **Surprises?** The engineering is far ahead of the evidence: a complete requirements spec, a design spec and a working true-scale sheet pipeline exist, against zero customer conversations. The decisions in REQUIREMENTS §19.1 are internally consistent but externally unvalidated.
- **Decision: Hold — do not pass this checkpoint.** M3 (payment, QA gate, full set) stays unstarted until A-1, A-2 and A-4 have results against the bars in 6.5. Permitted in the meantime: finishing the M2 fidelity proof, since it *is* the A-4 test.

---

## 7. Business Model

**7.1 How it makes money**
- One-time payment per project, in MVR (`FR-73`).
- Paid re-review fee when a post-release edit adds/removes a storey or moves the footprint past tolerance (`FR-75`); all sub-threshold edits and re-exports are free.
- Design, 3D and watermarked preview are free forever — the funnel, not a product.

**7.2 Price and how it was decided**
- Band ≈ MVR 4,600–12,300, exact figure an admin setting, never a constant in code (`FR-93`).
- Chosen to sit clearly under a firm engagement while covering two humans per project.
- `Unknown – to test` (OQ-1) — the exact figure needs the firm-quote benchmark and the willingness-to-pay test.

**7.3 Have customers shown they will pay?**
- No. No pre-orders, no deposits, no signed interest.

**7.4 Main costs**
- Architect QA time per project — the dominant variable cost.
- Engineer structural authoring per project — the other dominant one.
- Build effort to M3/M4: the derivation engine, sheet composition, backend, export worker.
- Ongoing: hosting plus the export worker, payment provider fees, support.
- Both human steps scale with headcount, not code (R-6) — so gross margin per project is roughly price minus two professionals' hours, and that is the number that decides the business.

**7.5 Cost to win a customer vs customer worth**
- Worth: one payment, plus an occasional re-review fee. No recurring revenue, so acquisition cost must stay far below a single sale.
- `Unknown – to test` — no channel has been run, so CAC is unmeasured. A one-shot purchase with no retention makes this ratio unusually unforgiving.

**7.6 Break-even**
- `Unknown – to test` — needs the price (7.2), measured QA/structural hours (A-6) and the volume figure (A-5). No credible date before those three exist.

---

## 8. Feasibility and Resources

**8.1 Buildable with current technology and skills?**
- Yes, and partly built. Next.js 16 / React 19, Three.js WebGPU with WebGL2 fallback, Zustand + Zundo, Zod node schemas, three-bvh-csg — all on the Pascal editor base (`@pascal-app/*`, MIT), which already covers much of `FR-1x`–`FR-3x`.
- Proven in-repo: plan derivation, pen table, true-scale PDF, grid bubbles, hatch, centreline dimensions, 1:50 fallback, opening marks.
- Unproven: elevations and sections with hidden-line removal — the hardest remaining derivation work.

**8.2 Skills on hand vs missing**
- On hand: the full studio and derivation engineering.
- Missing and mandatory: a licensed architect to review, sign and release every paid project (`FR-Q0`); a licensed engineer to author `S.01`–`S.12`.
- Missing: anyone doing customer research or sales.
- `Unknown – to test` whether an architect will take this role, on what terms, and whether they will sign generated output.

**8.3 Money to reach the next milestone**
- Next milestone is the M2 fidelity proof plus the §6 tests — printing, travel and a few hours of an architect's time.
- `Unknown – to test` for M3/M4, which need the two professionals on retainer or payroll.

**8.4 Where the money comes from**
- Self-funded to Checkpoint B.
- Beyond that: `Unknown – to test`.

**8.5 Suppliers, partners, materials**
- Hosted payment provider (no card data on our servers, `FR-77`).
- Hosting plus a server-side export worker.
- Retained architect and engineer — partners in practice, not vendors.
- Reference council sets per jurisdiction, as the spec for each new profile.

**8.6 Legal, regulatory, licensing, IP**
- The hard constraint: v1 delivers drawings only and must never imply a stamp, certification, approval or guaranteed submission (§1.3, R-4). A single careless line of marketing copy is the live exposure — hence the pre-launch copy audit.
- Professional licensing: the architect and engineer sign in their own names; their registration carries the professional responsibility.
- Pascal editor is MIT — safe to build on.
- Privacy: project data visible only to the owner and assigned staff; no auto-expiry in v1; customer deletion honoured (NFR-8).
- `Unknown – to test` whether Maldives regulation constrains who may prepare (not sign) submission drawings.

**8.7 Biggest technical and operational risks**
- R-1 Derivation fidelity — the largest technical risk; generated sheets must read as a draughtsman's.
- R-2 Print-scale correctness — mitigated by an automated physical-measurement check in CI.
- R-3 Council acceptance of a convention we failed to replicate.
- R-4 Implied certification drifting into copy or sales talk.
- R-6 Human throughput — two mandatory human steps set delivery time and cap volume.
- R-5 Non-architect layouts that are valid but unbuildable, absorbed by the QA gate's return-for-changes path.

---

## ✅ Checkpoint C — Ready to Build

- **Enough evidence?** No — Checkpoint B is unpassed.
- **Enough money?** `Unknown – to test` for M3/M4; sufficient for the M2 proof and the §6 tests.
- **Enough skill?** Engineering yes; the mandatory architect and engineer are not secured, and without the architect there is no release path at all (`FR-Q0`).
- **Decision: Wait.** Build only M2 and the evidence tests. Secure the architect in parallel — that conversation is both a hiring step and the A-4 test, so it costs nothing extra to run now.

---

## 9. Launch

**9.1 Where and to whom first**
- Greater Malé, owners of a single-plot house build, designing from scratch.
- Soft launch to the pilot owner and interview participants before any public push.

**9.2 Marketing and sales channels**
- Direct outreach to interview participants and pilot contacts.
- Maldivian building community groups on Facebook and Viber.
- Referral from hardware suppliers and small contractors.
- A landing page carrying the real watermarked preview as the main proof.
- No paid acquisition until CAC is measured against a one-time sale (7.5).

**9.3 Value proposition in one sentence**
- Draw your own building for free, see it in 3D, then buy the architect-reviewed drawing set for a fraction of a firm's fee.
- Must survive the copy audit: no "certified", "stamped", "approved", "council-ready" (DESIGN §11.4).

**9.4 Numbers that show success in the first three months**
- Paid projects completed end to end — the only number that matters first.
- Released sets accepted by a council on first submission.
- Preview-to-payment conversion.
- Median QA turnaround vs the committed target (`FR-Q7`).
- Return-for-changes rate — a proxy for whether non-architects produce buildable layouts.

**9.5 Support and feedback**
- Direct founder support by WhatsApp and email at this volume; no ticketing system.
- Every QA return and every council objection logged as product input, not just a case.
- Audit trail per project already provides the factual record (`FR-86`).

---

## 10. Learn and Improve

**10.1 Collecting feedback**
- A short call with every paying customer after release — at this volume, all of them.
- Architect QA notes mined for recurring model problems; each one points at a studio fix.
- Council objections per submission, tracked per jurisdiction profile.
- Drop-off points in the studio funnel.

**10.2 Testing changes before rolling out**
- The existing automated gates: print-scale measurement, schedule correctness, determinism, stamp reserve, release gating, override survival.
- Visual side-by-side against the reference set, architect-reviewed, for any derivation change.
- Second throwaway profile to prove the composition engine stays untouched (`FR-63`).
- Staff review of generated sheets precedes every customer-visible derivation change — the QA gate doubles as the release valve.

**10.3 Signs it is time to scale up**
- Councils accepting released sets consistently, with no recurring objection.
- QA turnaround holding under target while volume rises — the throughput constraint (R-6) is the real scaling signal.
- Preview-to-payment conversion stable across a channel we did not hand-pick.
- Demand for a second jurisdiction, where expansion is a profile plus staff.

**10.4 Signs to change direction or stop**
- Repeated council rejection of released sets.
- Architects reviewing but refusing to sign.
- QA plus structural hours per project exceeding the price.
- Customers completing free design but not buying — the preview sells the set, so a flat conversion means the set is not what they wanted.
- Customers consistently asking us to handle the stamp.

---

## 11. Summary

**11.1 Top three strengths**
- The hardest technical piece already works: plan derivation to a true-scale PDF, tested, against a real reference set.
- A clear, non-negotiable scope boundary (drawings only, §1.3) and a decided set of hard questions (§19.1) — the plan is unusually specific for its stage.
- Mandatory architect review makes quality structural, not sampled, and is the trust story a new company otherwise lacks.

**11.2 Top three risks**
- Council acceptance (A-1, R-3) — outside our control, and fatal if negative.
- Zero customer evidence — a complete spec built against assumptions nobody outside the team has tested.
- Two mandatory human steps (R-6) capping volume and margin, against a one-time price with no recurring revenue.

**11.3 Next three actions**
- **By 2026-10-25** — Put printed generated sheets in front of 2–3 practising architects: equivalent to the reference, and would you sign it? (A-4, and the start of securing the QA architect.)
- **By 2026-11-08** — Reach a council or permit-desk contact with a printed set and collect objections verbatim (A-1). Collect real firm quotes for a small house in the same window to benchmark the price (1.4, 7.2).
- **By 2026-11-22** — Run 10–15 owner interviews with the price and the drawings-only wording shown, and record deposit intent (A-2, A-7).

**11.4 Overall decision**
- **Go on evidence, wait on build.** The capability is real and the positioning is disciplined; the demand and the council route are assumptions. Finish M2 because it doubles as the A-4 test, run the three actions above, and revisit Checkpoints B and C with results in hand before committing to payment, QA and the engineer loop.
