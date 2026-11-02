# Phase 10 — Demo Prep, Video & Submission

> **Goal (done means):** by **Nov 11, 18:00 IST** the project is submitted on Devpost with a public repo (MIT license visible), a working hosted demo, a public YouTube video under 3:00, complete text (how PayPal and AI are used, tools list, evaluation results, limitations), and a verified, logged-out click-through of every link. After that: freeze.
> **Window:** Mon Nov 9 (freeze + draft) → Wed Nov 11 18:00 IST (submit) · official cutoff is **Nov 12 12:00 PT = Nov 13 01:30 IST** (do **not** use it) · **Budget:** 2.5 person-days · **Owners:** D (video lead), C (screens/screenshots), A+B (fixes, text accuracy), everyone (QA).

## Preconditions
- Phases 1–9 tagged; `main` is deployed; eval/chaos results committed; `/health` green; no open `P0` issues.
- Feature freeze announced Nov 9 23:59 IST; branch protection requires one review for any merge after that time.

## Implements
`roadmap.md` §8–§10 (demo script, submission checklist) · `testing.md` §6 (manual QA) · `readme.md` · Devpost requirements (`01_idea_evaluation_and_pick.md` §1: working demo, public repo with license, YouTube video < 3 min, text description, tools list) · `deployment.md` §7 (demo insurance).

## Task breakdown

### 10.1 Freeze and QA (Mon Nov 9 evening → Tue Nov 10 morning) (All)
- [ ] Create `release/v1.0.0-rc1` tag on `main`; post in team channel: "Freeze: only P0 fixes."
- [ ] Execute `testing.md` §6 manual QA checklist **in full** on the hosted URL (incognito, fresh persona): environment, five scenarios, UI (light/dark, keyboard, axe), submission items. Record results in `docs/qa-log.md` (date, tester, pass/fail, notes). Each failure becomes a GitHub issue labeled `P0` or `P1`.
- [ ] Fix only `P0` (blocks the demo, money safety, security). `P1` → documented in README "Limitations" if not fixed.
- [ ] Run `npm run eval` (all) and `npm run chaos` one final time against the hosted environment's code (same SHA as `rc1`); commit refreshed `docs/eval-results.md` and `docs/chaos-results.md` only if numbers changed; update README table.
- [ ] Confirm LLM budget remaining ≥ $3 and Render/Anthropic caps unchanged.

### 10.2 Repository finalization (Owner A + B) — public repo requirement
- [ ] README final (from `readme.md`): replace all `<...>` placeholders (demo URL, YouTube URL, Devpost URL, repo URL, team names/roles); real evaluation numbers; confirm the quick-start works on a **clean clone in a fresh directory** (`git clone`, `cp .env.example .env`, fill keys, `docker compose up -d`, `npm i`, `npm run db:migrate && npm run seed`, `npm run dev`, `npm run worker`) — time it (< 10 min) and note the time.
- [ ] Add `docs/architecture.png` exported from `architecture.md` Mermaid (`npx -p @mermaid-js/mermaid-cli mmdc -i docs/architecture.mmd -o docs/architecture.png -b transparent`), embed in README.
- [ ] Add `docs/proof-pack-sample.json` (from a real scenario run) and link it.
- [ ] `LICENSE` present at repo root; GitHub **About** box shows "MIT License" (set repository topics: `paypal`, `ai-agents`, `agentic-commerce`, `mcp`, `claude`).
- [ ] Final secrets check: `gitleaks detect --redact`; `git log --all -p | grep -iE "client_secret|sk-ant|pp_k_" | head` (must be empty); rotate any key that ever appeared.
- [ ] Make the repo **public** on Nov 10 evening (after the secrets check); confirm from a logged-out browser.

### 10.3 Demo preparation (Owner D + C) — `roadmap.md` §8
- [ ] **Environment snapshot:** `pg_dump` of the hosted DB before recording; confirm `DEMO_TIME_SCALE=1`, `DEMO_USE_FIXTURES=true`, `CHAOS_MODE=true`, dark mode default for the recorder profile.
- [ ] **Screen setup:** browser profile "ProofPay-Demo" (no extensions, no bookmarks bar), 1440×900 window, zoom 110%, notifications off, desktop clean; second window prepared for the PayPal sandbox approval with the buyer already logged in (to avoid typing credentials on camera; use a throwaway sandbox buyer).
- [ ] **Rehearse** the script from `roadmap.md` §8 five times with a stopwatch; target **2:50**; note any step > 8 seconds of dead time and fix (pre-warm, fixtures, shorter delays via `DEMO_STEP_DELAY_MS`).
- [ ] Prepare **assets:** (1) stat card (71% of freelancers — **re-verify the figure and source before using; if you cannot verify, show the qualitative problem statement instead**), (2) architecture slide (`docs/architecture.png` + tagline), (3) eval slide with the real numbers and the small-sample caveat text, (4) end card with demo URL and repo URL.
- [ ] Prepare 4–5 **screenshots** for Devpost: Studio with lint fix, Funds Bar mid-release, Verification Report with highlighted evidence, manipulation callout, Ledger grid with chain badge. Export at 1600×1000 PNG; filenames `01-studio.png` … `05-ledger.png`.
- [ ] Write the **voiceover** (from the script table) in `docs/video/voiceover.md`; record audio separately (quiet room, pop filter or phone mic ≤ 20 cm, -12 dB peaks), 48 kHz WAV.

### 10.4 Video production (Owner D; C reviews) — Devpost video rules
- [ ] Record screen at 1080p/30 fps (OBS: Display Capture, `1920x1080` canvas scaling from 1440×900 window, CBR 12 Mbps, MKV → remux MP4). Record each segment **separately** (Studio, Fund+PayPal, Agent Console, Injection, Capture-declined, Ledger/Proof Pack) with 2+ takes.
- [ ] Edit (DaVinci Resolve/CapCut/Descript): cut dead time; zoom/highlight on key moments (rejection reasons, Funds Bar move, manipulation callout); add lower-thirds only where needed; **burn in captions** (generate SRT, check accuracy); **no copyrighted music** (silence or a royalty-free/CC0 track with attribution in description); **no third-party logos** except what naturally appears on PayPal's own checkout page (do not add logos to your graphics).
- [ ] The video must show **the project functioning on the device it was built for** (the web app in a browser; also show the URL bar once). Total length **≤ 2:58**; verify with the export's duration (not the timeline).
- [ ] Export H.264 MP4 1080p, AAC 192 kbps. Upload to **YouTube** (title: `ProofPay — Pay when it's proven | PayPal AI Hackathon`; description: one-paragraph pitch, repo + demo URLs, tools used, timestamps, "PayPal sandbox only; authorization hold, not escrow"; category Science & Technology; **Visibility: Public** — not unlisted; "Not made for kids"; captions uploaded).
- [ ] Wait for processing to finish (HD available). Test playback logged-out in an incognito window and on a phone.
- [ ] Keep a local backup of the final MP4 and project file; copy the video link into `README.md` and the `NEXT_PUBLIC_DEMO_VIDEO_URL` Render env var; redeploy (P0-only merge allowed for env/README change).

### 10.5 Devpost submission (Owner A drafts, B and C review) — `readme.md`, `01_idea_evaluation_and_pick.md` §1
- [ ] Start the Devpost submission **draft on Nov 9** and save; fields: project name, tagline, **text description** (sections: Inspiration/Problem, What it does, **How PayPal is used**, **How AI is used**, How we built it, Challenges, Accomplishments (with real eval/chaos numbers), What we learned, What's next, Limitations — plainly state: authorization hold not escrow, sandbox only, small-sample verifier evaluation), **Built with** (Next.js, TypeScript, Postgres, Drizzle, Zod, Ajv, PayPal Orders v2/Payments v2/Webhooks (sandbox), Anthropic Claude, MCP SDK, AG Grid, Render, GitHub Actions), **Tools used** with how each was used (AI model and PayPal APIs listed explicitly), try-it-out links (hosted demo, repo), video link, image gallery (screenshots), and any sponsor selections (**AG Grid**, **Render**; add APIMatic only if actually used).
- [ ] Confirm each **mandatory requirement** in a checklist inside `docs/submission-checklist.md`: working build runnable (hosted URL **and** README setup), public repo + license in About, YouTube public < 3 min, text description, tools list, PayPal integration central, project documented.
- [ ] Add judge instructions at the top of the description: "Try it in 3 steps (Judge Mode)" and the sandbox buyer credentials (sandbox only).
- [ ] Have **two people** proofread the Devpost text against `README.md` and the video (numbers must match everywhere).
- [ ] **Submit on Nov 11 by 18:00 IST** (≥ 6 h buffer is not needed beyond the 31.5 h to the official cutoff, but keep slack for Devpost or YouTube hiccups); screenshot the confirmation page into `docs/submission-checklist.md`.
- [ ] After submitting: open the public Devpost project page logged-out; click every link (demo, repo, video); run `npm run smoke:hosted`; verify webhook deliveries are still green.

### 10.6 Post-submission freeze and judging-window handoff (All)
- [ ] Tag `v1.0.0-submission` on the exact deployed SHA; GitHub Release with the video link and result docs.
- [ ] Freeze rules: no deploys except P0; changes to the repo after submission must not break the quick-start; keep `main` identical to the submitted SHA unless a P0 fix is needed (note it in README "Post-submission changes").
- [ ] Backups: zip of repo, DB dump, final MP4, screenshots, Devpost text → shared drive.
- [ ] Start the on-call calendar from `docs/runbook.md` (Phase 9) through Dec 15.

## Real-world engineering concerns
- **Demo reliability:** same SHA for recording and submission; DB snapshot before recording; PayPal sandbox outage → retry later or use a previously recorded segment (never fake responses).
- **Truthfulness:** every number in the video/README/Devpost comes from committed result files; the 71% statistic only if re-verified; "hold, not escrow" stated; reauthorization limitation stated.
- **Security in the video:** no real secrets on screen; sandbox buyer only; blur PayPal developer dashboards; close password managers.
- **Accessibility of the video:** captions on; sufficient contrast; no flashing.
- **Rate limits during recording:** run scenarios on your own IP sparingly (limit 5/h); use a separate window of time for retakes or temporarily raise the limit via env on the demo deployment (restore after).
- **Time zones:** all deadlines expressed in IST in the team calendar; official cutoff noted but unused.

## Definition of done
- [ ] Devpost submission status shows **Submitted** (not Draft), screenshot saved; confirmation email received.
- [ ] YouTube video is **Public**, duration **≤ 3:00**, plays logged-out; link is on Devpost, in README, and in the app's Judge Mode panel.
- [ ] GitHub repo is **public**, LICENSE (MIT) visible in About, README quick-start verified on a clean clone, no secrets in history.
- [ ] Hosted demo passes `smoke:hosted` and a full real-sandbox `reject_then_pass` run from an incognito window **after** submission.
- [ ] README, Devpost text and video agree on all numbers (eval, chaos) and limitations; two reviewers signed off in `docs/submission-checklist.md`.
- [ ] Tag `v1.0.0-submission` exists on the deployed SHA; backups stored.
- [ ] On-call calendar events exist through Dec 15.

## Risks & blockers
| Risk | Mitigation |
|---|---|
| Video exceeds 3:00 | Target 2:50; verify exported duration; cut the capture-declined segment first, then shorten the intro |
| PayPal sandbox slow/outage while recording | Record Nov 10 (not Nov 11); retake later; keep earlier takes; never fake |
| YouTube processing delay or copyright claim | Upload by Nov 10 night; silent or CC0 audio; check "Copyright" tab |
| Last-minute bug | Freeze policy; P0-only fixes with review; rollback runbook |
| Devpost form surprises (field limits, required fields) | Draft saved Nov 9; read full rules; submit early |
| Mismatched numbers across docs | Single source: `docs/eval-results.md` and `docs/chaos-results.md`; copy/paste, don't retype |
| Judge cannot run it | Judge Mode + recorded demo + README quick-start; credentials banner |

## Time budget
**2.5 person-days** (D 1.0 video; C 0.5 screenshots/slides/UX polish; A 0.5 repo/README/Devpost; B 0.25 numbers/text accuracy; all 0.25 QA). **Cut first if long:** extra screenshots (keep 3), architecture PNG polish, GitHub Release notes. **Do not cut:** manual QA, video, public repo + license check, logged-out link verification, submission on Nov 11.

## Handoff
Final state: submitted project, frozen `main`, hosted demo under on-call watch through **Dec 15**; Dec 16 teardown per `deployment.md` §8.
**Tags:** `git tag phase-10-submission && git tag v1.0.0-submission && git push --tags`
