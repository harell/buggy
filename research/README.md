# Shuttle 08 research: desk findings

Research brief dated 13 Oct 2026. This folder holds the parts of the brief that can be done without the car in hand: the online half of Step 1, a fillable Step 3 table, and notes on the brief itself. Everything else needs someone with the car, a caliper and a camera.

## Status by step

| Step | Status | Notes |
|---|---|---|
| 1. Confirm the exact model | Online part done, see below | Box, manual and sticker photos still need the physical car. |
| 2. Outside photos | Not started | Needs the car. |
| 3. Outside measurements | Table ready: [`measurements.csv`](measurements.csv) | Measured column is empty. |
| 4. Remote | Not started | Needs the remote. |
| 5. Teardown | Not started | Needs the car. |
| 6. Inside details | Not started | Needs the car. |
| 7. Motion videos | Not started | Needs the car. |
| Optional 3D scan | Not started | Needs the car. |

## Step 1 findings

Pending: online search in progress.

## The current guesses match the code

I checked the brief's "current guess" column against `index.html`. It matches what the model actually draws, so a measured value can go straight into the constant listed in the last column of `measurements.csv`. Spot checks:

- Wheelbase 150 mm: `XF=7.5`, `XR=-7.5`, `WB=15` (the model is in centimetres).
- Track 114 mm: `TZ=5.7` is half the track.
- Tyre 72 × 30 mm: `R=3.6` and the `TIRE_GEO` profile. The tread has 20 lugs per row in two staggered rows. That count is also a guess.
- Steering lock 24°: `STEER_MAX=0.42` rad.
- Gear ratio 8:28 then 10:30 (10.5 : 1): `RATIO`. This is illustrative, not measured.
- Shock body: the code draws 5.6 mm, not the 6 mm in the brief.
- Light bar: the code draws 8.5 mm high, not 8 mm, with 3 LEDs.

## Problems with the brief

1. **Photos can't reach the 1 mm target, so the caliper table must.** With the camera 1.5 m from the car, perspective is still large. In a side view the far tyre is 145 mm further from the lens than the near one, so it appears about 10% smaller. A feature at the end of the car, 72 mm off the ruler's plane, shifts by about 6 mm. Zoom doesn't help, because distance sets perspective. Getting that error under 1 mm would take a camera nearly 9 m away. So:
   - Scale each blueprint from caliper values measured in that view's plane (wheelbase for the side views, track for the front and rear views), not from the ruler in the photo.
   - Treat the photos as shape references, and take the numbers from the table and the scan.
   - If the ruler has to set the scale, raise it to the car's centreline (on a block, at axle height and halfway across), not touching the near side.
2. **3–4 hours is tight.** Step 5 alone is 11 sub-steps, each with before and after photos and labelled screws. Step 6 adds tooth counts and caliper work on every gear. Plan for 5–6 hours, or do only the "if time is short" list in one session.
3. **Ask for the shell's thickness and the gearbox axle positions explicitly.** The shell's thickness is only photographed (Step 5.3), never measured, and Step 6 asks for gear tooth counts but not the centre-to-centre distance between gear shafts. You need the shaft spacing to place the gears, and you can check it against the tooth counts (spacing = module × (z1 + z2) / 2). Add both:
   - shell thickness at an edge, with the caliper
   - gear shaft centre distances, measured as outside-to-outside of two shafts minus one shaft diameter
4. **The battery cell's size decides the battery bay.** The model draws a 15.6 × 56 mm cylinder, close to a 14500 cell (14 × 53 mm). If the real cell is a flat pack or an 18650 (18 × 65 mm), the battery bay and the chassis under it change. Measure the cell, not only its label.
5. Small: the scan section's "after Step 5, step 5" means "after the bare-chassis photos in Step 5". Step 3 rows for coil count, steering angle and weight aren't in mm. `measurements.csv` labels those rows.

## Handover

The brief's handover is a shared Google Drive or Dropbox folder, using the folder names in its last section. This repo only holds text: the measured table and these notes. Keep the photos and videos in the shared folder at full resolution. Don't commit them here.
