# Image prompts for the landing page

The page uses the Furrow look: warm manila paper, near-black ink, natural daylight, slightly muted colour. Every prompt below is written to match it. Generate at the size given or larger, then drop the file in at the path shown (same file name) and the layout picks it up with no code change. If the subject changes, tell me and I'll update the image's alt text.

Rules that apply to every image:
- No text, numbers, logos or brand names anywhere in the frame (the current padlock says "SOLEX" and the server racks carry an "SGI" badge; both should go).
- No people's faces, no hands typing on glowing keyboards, no coins with a "₿" or "S" stamped on them, no neon, no holograms, no robots.
- Natural daylight, soft shadows, not golden hour, not dramatic studio lighting.
- Photographic, shot on a full-frame camera, 35mm to 50mm lens, shallow but not extreme depth of field.

---

## 1. "Locked until the work is right" (the escrow section)

- **File:** `app/public/photos/padlock.jpg`
- **Shape:** very wide, 21:9. Generate at least **2560 × 1100**.
- **What it must say:** money is held safely until a condition is met.
- **Keep the subject in the right two-thirds**; the left third should be calm surface.

Prompt:
> A heavy solid-brass padlock, closed, resting on a worn oak desk beside a small steel cash box with its lid shut, soft north-facing window light from the left, warm natural tones, fine wood grain visible, gentle shadow under the lock, a little empty desk space on the left of the frame, quiet and serious mood, photographic, 50mm lens, f/4, no text, no logos, no brand markings, no people, 21:9 wide composition

Alternative, if you want it less literal:
> Two old brass keys tied together with plain cotton twine lying on a closed leather-bound ledger on an oak table, daylight from a side window, warm muted colour, shallow depth of field on the keys, calm and trustworthy mood, photographic, no text, no logos, 21:9 wide composition

---

## 2. "Who decides, and how" (the AI judge section)

- **File:** `app/public/photos/data-centre.jpg`
- **Shape:** portrait, 4:5. Generate at least **1600 × 2000**.
- **Sits on a near-black section**, so a darker image with clean highlights works best.
- **What it must say:** a neutral machine makes the ruling, calmly and by the rules.

Prompt (machine, closest to the current photo):
> A quiet, clean server aisle seen straight down the middle, matte black racks on both sides with tiny pale status lights, a pale concrete floor leading to a softly lit doorway at the far end, cool neutral daylight, symmetrical, calm and orderly, no visible logos or labels, no people, photographic, 35mm lens, portrait 4:5

Prompt (judgement, warmer and more "human"):
> An empty wood-panelled hearing room with a single raised judge's bench, a plain wooden gavel and its block resting on the bench, daylight falling through tall windows, dust motes in the light, muted warm tones, still and impartial mood, no people, no flags, no text, photographic, 35mm lens, portrait 4:5

---

## 3. Optional: a hero image

The hero is currently type plus the before-and-after table, which is deliberate. If you'd rather lead with a photograph, generate this and ask me to switch the hero to sit beside it.

- **File:** `app/public/photos/hero.jpg`
- **Shape:** 4:5 portrait, at least **1600 × 2000**.

Prompt:
> A sealed manila envelope held shut with a red wax seal and a brass clasp, lying on a dark oak desk next to a fountain pen, soft daylight from a window on the right, warm muted colour, a sense of a promise that is kept until it is opened, photographic, 50mm lens, f/2.8, no text, no logos, portrait 4:5

---

## Not an image prompt: the app screenshot

`app/public/screens/hire-panel.png` is a real screenshot of the app and should stay one. Don't generate it. Once the program is deployed and a job has been slashed, ask me to re-capture the job record instead: a real slashed job is the strongest picture this page can show.
