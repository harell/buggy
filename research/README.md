# Shuttle 08 research: desk findings

Research brief dated 13 Oct 2026. This folder holds the parts of the brief that can be done without the car in hand: the online half of Step 1, a fillable Step 3 table, and notes on the brief itself. Everything else needs someone with the car, a caliper and a camera.

## Status by step

| Step | Status | Notes |
|---|---|---|
| 1. Confirm the exact model | Mostly done online: DK087 (ZWN), no FCC ID found | Still needs the car: box, manual and sticker photos. Still needs a normal browser: the AliExpress listing photos. |
| 2. Outside photos | Not started | Needs the car. |
| 3. Outside measurements | Table ready: [`measurements.csv`](measurements.csv) | Measured column is empty. |
| 4. Remote | Not started | Needs the remote. |
| 5. Teardown | Not started | Needs the car. |
| 6. Inside details | Not started | Needs the car. |
| 7. Motion videos | Not started | Needs the car. |
| Optional 3D scan | Not started | Needs the car. |

## Step 1 findings

**Model: DK087, usually sold under the brand ZWN.** "SHUTTLE 08" and "WILD ROAD" are only decal text. A search for either name finds no RC car. Searches for "DK087" find the car.

Confidence: high that this is the same body style, medium that it is the exact same factory model. YouTube titles pair the names directly (checked with YouTube's oEmbed API):

- "upgrade carrinho de controle remoto shuttle / dk087 para automodelo part 1" (planando na eletronica)
- "Unboxing RC Wild Road Shuttle 08 ..." (Syazia)
- "Carrinho de Controle Remoto DK087 | Unboxing e Primeiras Impressões" (Tássio Sousa)
- "... CARRINHO DE CONTROLE REMOTO ZWN DK087" (Rafa Mendes Importações)

Thumbnails show an orange version with the same SHUTTLE / 08 decals, WILD ROAD wing, roof light bar, coil-overs and front bumper. Nobody has compared it side by side with the blue car yet.

**FCC ID: none found.** Searches for "DK087" and "ZWN" on fccid.io and the wider web found nothing. Most of the videos and listings are Brazilian, so the car may never have been filed with the FCC. The sticker check in Step 1 still matters: look for an FCC ID, a CE mark, or a Brazilian ANATEL number. The ANATEL lead is a guess.

**AliExpress listing: not saved.** Item 1005013036812072 redirects to aliexpress.us item 3256812850497320. Plain HTTP fetches and headless Chromium both hit AliExpress's captcha, so the listing photos, video and "Specifications" block (which usually has a Model Number field) still need saving by hand from a normal browser.

### Seller specs for DK087 / Shuttle (unverified)

These come from video descriptions, and seller text is often copied between listings. Treat each line as a lead to check against the car.

| Item | Seller claim | Source |
|---|---|---|
| Drive motor | 130-size brushed ("130 escovas do carbono") | [JaBh-09TdVA](https://www.youtube.com/watch?v=JaBh-09TdVA), [6GwEvUif_Ms](https://www.youtube.com/watch?v=6GwEvUif_Ms) |
| Battery | 3.7 V 500 mAh Li-ion, **14500 cell** (AA size), SM-2P ("SMP02") plug, USB charger | [bsY0dnStHv4](https://www.youtube.com/watch?v=bsY0dnStHv4) |
| Remote batteries | AA, not included | [bsY0dnStHv4](https://www.youtube.com/watch?v=bsY0dnStHv4) |
| Drive | 2WD (rear) | [g98FtqkwXWQ](https://www.youtube.com/watch?v=g98FtqkwXWQ), [o9N3XDC3NYg](https://www.youtube.com/watch?v=o9N3XDC3NYg) |
| Speed / range | 20 km/h, 50 m | [Fkc4RQd78lI](https://www.youtube.com/watch?v=Fkc4RQd78lI) |
| Run time / charge | 12–30 min / 90 min (sources disagree) | several |
| Size | "16.5 × 15 × 6.8 cm" and "28 cm": both conflict with the 24.5 × 14.5 × 9.5 cm in the listing | [JaBh-09TdVA](https://www.youtube.com/watch?v=JaBh-09TdVA), [6GwEvUif_Ms](https://www.youtube.com/watch?v=6GwEvUif_Ms) |
| Body | "alloy" in most listings, "plastic" or "ABS" in two | [bsY0dnStHv4](https://www.youtube.com/watch?v=bsY0dnStHv4), [8eYox1p26xA](https://www.youtube.com/watch?v=8eYox1p26xA) |

The listings disagree on size and body material, which is why the caliper table matters.

### Videos to check for Step 1's last box

Nobody has posted a plain teardown of this car. The closest is a two-part video converting it to a hobby servo and ESC, which should show the opened chassis and the original electronics:

- [Part 1](https://www.youtube.com/watch?v=yilGrz7ghgk), 1:08
- [Part 2](https://www.youtube.com/watch?v=9LzazMqi8oY), 3:44

Someone ripping out the steering to fit a servo also suggests the stock car has no servo.

Timestamps below are only the ones that come from the video's own chapters. Nobody has watched these videos yet:

| Video | Length | Useful for |
|---|---|---|
| [Fkc4RQd78lI](https://www.youtube.com/watch?v=Fkc4RQd78lI) "DK087 Off-Road Motor" | 2:38 | Possibly the motor |
| [ed8tpJhneGY](https://www.youtube.com/watch?v=ed8tpJhneGY) "SHUTTLE ... IS IT WORTH IT?" | 3:18 | Remote at 0:25, lights at 1:03 |
| [hQnjcsGtLEE](https://www.youtube.com/watch?v=hQnjcsGtLEE) "4X4 RC DK087 ..." (Gabetech) | 5:26 | Unboxing at 0:19 |
| [JyGjK9I9WCo](https://www.youtube.com/watch?v=JyGjK9I9WCo) "Unboxing RC Wild Road Shuttle 08" | 11:36 | Box, exterior |
| [6GwEvUif_Ms](https://www.youtube.com/watch?v=6GwEvUif_Ms) DK087 unboxing | 11:28 | Box, exterior, specs |
| [kL6LxHnx8Oo](https://www.youtube.com/watch?v=kL6LxHnx8Oo) ZWN DK087 full review | 17:25 | Exterior, remote, battery |
| [Gm50G7li1pA](https://www.youtube.com/watch?v=Gm50G7li1pA) "SHUTTLE RC ... (UNBOXING)" | 16:01 | Exterior, remote |
| [bsY0dnStHv4](https://www.youtube.com/watch?v=bsY0dnStHv4) orange 08 SHUTTLE | 4:17 | Battery kit |

Listings to check for more angles: Google "ZWN DK087" or "DK087 1:16", and the rcdrone.top ZWN pages (rcdrone.top/products/zwn-rc-car). eBay, Jaycar and rcdrone.top all blocked automated access, so nobody has checked these by eye.

### The teardown the model was built from is a different car

The repo README calls https://github.com/slackhappy/rccar a "near-identical" toy. It isn't: it's a **TOQIBO 1/16 "GALE"** buggy with a plastic body, and its board has a **4.8 V** supply pad. That fits a 4-cell NiMH pack, not this car's single 3.7 V 14500 cell. It is still a fair guide to the electronics, which are the same generic design:

- a 2.4 GHz "RX2" receiver chip
- an FNK4421 + FNK9928 MOSFET H-bridge for the drive motor
- an MX612 H-bridge driving a plain steering motor, with no pads for a position sensor (potentiometer)
- a 662K 3.3 V regulator

But nothing in it can be trusted for this car's battery, layout, gear counts or dimensions.

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
4. **The battery cell's size decides the battery bay.** The model draws a 15.6 × 56 mm cylinder, close to a 14500 cell (14 × 53 mm), which is what DK087 sellers list. If the real cell is a flat pack or an 18650 (18 × 65 mm), the battery bay and the chassis under it change. Measure the cell, not only its label.
5. Small: the scan section's "after Step 5, step 5" means "after the bare-chassis photos in Step 5". Step 3 rows for coil count, steering angle and weight aren't in mm. `measurements.csv` labels those rows.

## Handover

The brief's handover is a shared Google Drive or Dropbox folder, using the folder names in its last section. This repo only holds text: the measured table and these notes. Keep the photos and videos in the shared folder at full resolution. Don't commit them here.
