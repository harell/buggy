# Shuttle 08 research: online findings

Research brief dated 13 Oct 2026. Nobody here has the car yet, so everything below comes from online sources:

- buyer review photos on 19 AliExpress listings (about 640 photos and 870 review texts)
- your own listing's gallery
- reseller pages
- a Mercado Libre turntable clip
- storyboard frames from about 40 YouTube videos

Each topic was answered by one agent and then re-checked by a second agent that tried to refute every claim. This file gives the checked result.

- [`measurements.csv`](measurements.csv) has the Step 3 table with online estimates. Its `measured_mm` column is still empty for caliper values.
- The photos are on a private reference page, [Shuttle 08 Reference Board](https://claude.ai/artifact/FwpCxTfpqhKXv9FLjn3dbv), not in this repo. The repo is public, and the photos belong to sellers and buyers. Every source below is a public URL.

## What changes in the model

These are the findings most likely to change `index.html`. Each one is backed by photos of the real car, not seller renders.

1. **The wheels are much smaller.** Tyres are 60 ± 2 mm, not 72. The wheel ring is 33 ± 1 mm, not 50. It is matte light grey (about `#B0BEC8`), not chrome, with 5 moulded bolt circles. The rim has 5 Y-split spokes and a single central Phillips screw.
2. **The wheelbase is 146.5 ± 3 mm.** Track is about 117 mm at the front and 119 mm at the rear. Width outside the tyres is about 141.5 mm.
3. **There is no tube roll cage and no one-piece shell.** The upper body is a black moulded-plastic frame with round-section bars about 2–2.5 mm thick. Separate painted sheet-metal panels are screwed onto it: the hood, two side pods and the roof plate, with 3 screws each on the roof and hood and about 3 per pod. The frame, panels and light bar lift off the chassis together.
4. **The body is shorter and the nose narrower.** The painted panels run about 149 mm from hood tip to side-panel rear edge, not 205. At the front axle there is only the hood, about 40 mm wide.
5. **The front bumper is about half as wide as modelled.** It is a flat plate about 44 mm wide (not 86), with a tubular hoop behind it about 66 mm wide.
6. **The light bar is smaller.** It has 3 white LEDs at 8.5–10 mm pitch in a black bar about 30 mm wide, sitting in a U-notch at the roof's front edge.
7. **Front suspension has one wide lower arm per side, with no upper arm.** Each arm is a plate with two windows. The knuckle turns on a vertical screw at the arm's end, and the shock runs from the arm end to a tower beside the hood.
8. **The rear is a live axle.** The motor sits crosswise in the right-hand lobe of the gearbox, behind the axle line. Motor, gearbox and axle almost certainly swing as one unit on the rear shocks. One buyer says there is no differential.
9. **Shocks are springs only, with about 9 coils.** Buyers say there is no oil. Bodies are black plastic and springs are bright silver.
10. **Steering is bang-bang.** It is a plain motor going full left, centre or full right. A steering-trim dial sits on the underside.
11. **The remote is not proportional**, and it has no trim or speed switch. Its controls are covered under Step 4.
12. **The battery bay is on the underside.** It holds one 14500 cell lying crosswise under a cover held by one screw. The power switch is on the underside too.

The current model's 245 × 145 × 95 mm came from the seller's dimension callout on your listing's package image ([g05](https://ae01.alicdn.com/kf/Sa80d2e6f848b46d78bc3b915bbff8272l.jpg)). It was never an independent measurement.

## How the scale was fixed

All absolute sizes rest on one buyer photo of an orange DK087 on a 1 cm cutting mat with a steel ruler ([photo](https://ae-pic-a1.aliexpress-media.com/kf/Ade13166ca2f9436d8ac2769a5d1201c6h.jpg)):

- A homography fitted to 91 grid intersections has 1.2 px RMS error.
- The rectified ruler confirms the 10 mm pitch to within 1%.
- The solved focal length matches a phone's main lens.
- Fitting both left wheel rings as 3D circles at hub height gives a wheelbase of 146.4 mm (144.4–149.1 depending on hub height) and a ring diameter of 32.6–33.1 mm.

Three other sources agree:

- A top-down photo on an A4 sheet, though only 282 × 500 px, gives about 145 mm.
- The ratio of wheelbase to ring diameter (4.36) is the same in four side views, including a turntable clip.
- The tyre-to-ring ratio matches.

Heights come from one level photo of a blue car on a glossy floor ([photo](https://ae-pic-a1.aliexpress-media.com/kf/S14ddf29b15cf47deb8b538f282d291e3H.jpg)). Its reflections mark the floor line.

Uncertainties in `measurements.csv` are honest ranges, not pixel precision. Nothing from photos reaches the brief's 1 mm target, so the caliper is still needed.

## Step 1: Identity

- **Model:** factory number **3699-087**, seller code **DK087**. Variant codes such as `DK087 Blue 1B` appear in your listing's own review data. Other SKU strings are `DK087-Hei-3B` (black) and `OK.DK087.Cheng.2B` (orange). "SHUTTLE", "08" and "WILD ROAD" are decal text only.
- **Factory:** XIANG HENG TOY FACTORY, Daping Industrial Zone, Lianxia Town, Chenghai District, Shantou, Guangdong. This is printed on box stickers ([photo](https://ae-pic-a1.aliexpress-media.com/kf/A8221351d5c2a472bb0406d0bc6a47bb2M.jpg)) and on a blue car's battery cover ([photo](https://ae-pic-a1.aliexpress-media.com/kf/Adfab364a21004b40ac537fee398f99d0K.jpg), batch 20250101, produced 2025-04-01). The contact e-mail is oikesale@163.com.
- **Brands:** the box brand is **K.K**. ZWN, Oike, X-Verse and SZJJX resell the same car. The red SZJJX version on Amazon is the same body.
- **Box (K.K colour box):** buyers on your listing received this box. It reads:
  - NO.3699-087, 20 KM/HOUR, 5 CHANNEL R/C FULL FUNCTION CAR
  - icon row: 1:16, 2.4 GHz, shock absorber, rubber tyre, 3.7 V lithium, forward light, 2WD, alloy sheet
  - blue-car artwork on one long side and black on the other
  - warnings and FCC Part 15 / IC statements on the bottom ([photo](https://ae-pic-a1.aliexpress-media.com/kf/Ac5fd5375c49f4208bd99537ef3d9902fK.jpg))

  Window and foam-box packagings also exist.
- **FCC ID: none.** The box carries only the Part 15 statement, with no FCC ID, IC number or certificate number. So there are no FCC internal photos to download. Brazil's ANATEL open data has no match either.
- **Manual:** a folded diagram sheet covers battery installation, the remote's functions and the lights button. There is also a battery-warning page and a multilingual text sheet. No exploded view or parts list exists online. The only photo of the real sheet is 220 × 500 px.
- **Moulded and printed text:** the battery cover carries 2.4GHz, CE, UKCA, WEEE, CAUTION-ELECTRIC TOY, MADE IN CHINA, "OPNE" (sic) and K.K ([photo](https://ae-pic-a1.aliexpress-media.com/kf/Adb91e9199e8348eb8490854ae422ec66Q.jpg)). The bay floor says DC 3.7V. The only blue-car underside photo shows a plain cover with a printed factory label, so covers vary by batch.
- **Videos:**
  - The only stock teardown is [Fkc4RQd78lI](https://www.youtube.com/watch?v=Fkc4RQd78lI), an orange car, 158 s:

    | Time | What it shows |
    |---|---|
    | 31–39 s | Shell screws |
    | 43–47 s | Shell lifted off |
    | 51–71 s | Tub lid off |
    | 73–75 s | Receiver board |
    | 77–79 s | Empty bay |
    | 104–111 s | Wheel off |
    | 122–132 s | Gearbox cap off and motor out |

  - [yilGrz7ghgk](https://www.youtube.com/watch?v=yilGrz7ghgk) and [9LzazMqi8oY](https://www.youtube.com/watch?v=9LzazMqi8oY) show a car converted to a hobby servo and speed controller. They are not stock.
  - YouTube refuses video downloads from here, so frames are 320 × 180 storyboard tiles plus 1280 × 720 thumbnails.

## Step 2: Outside

Best photos per view are on the private page. Most are of the real blue car. The near-level side, front and rear views come from a black car on a turntable ([Mercado Libre clip](https://www.mercadolibre.com.pe/shorts/clips/AjYkuF/buggy-rc-1-16-2wd-vehiculo-juguete-control-remoto-negro)).

**Missing online:**
- true orthographic views of the blue car
- a flat-on view of the wing underside
- the cockpit with the roof off
- the inside of the shell

**Decals on the blue car:**

| Where | Decal | Reads correctly from |
|---|---|---|
| Roof | Large italic dark navy "08", small white italic "SHUTTLE" toward the front | Front |
| Hood | White italic "SHUTTLE" along the centreline, with a thin stripe to the nose | Left |
| Left pod | Upright "08", then "SHUTTLE"; "WILD ROAD" in a white frame | "WILD ROAD" reads bottom to top |
| Right pod | "SHUTTLE", then "08" at the front | "WILD ROAD" reads top to bottom |
| Wing | Pale "WILD ROAD" | Front |

The "OFF-ROAD" decals appear only in seller renders.

**Colours** were sampled from daylight photos and white-balanced, so treat them as starting points:

| Part | Hex |
|---|---|
| Blue paint, lit | about `#1550F0` |
| Blue paint, mid | `#1E4FD0` |
| Blue paint, shadow | `#0A2F95` |
| Black plastic | about `#1E1F22` to `#2F3136` |
| Tyre | about `#1C1F22` |
| Wheel ring | `#AEBDC6` |
| Decal white | `#E6F0F6` |

The paint has fine silver metallic flake.

**Other details:**
- **Tyre tread:** two staggered shoulder rows of hook-notched lugs, about 30 per row (range 28–34), with smaller centre blocks. The tread is non-directional, and the left and right tyres look the same.
- **Screws:** all visible fasteners are silver Phillips pan-heads, with no clips. The nose plate has 3 screws from below and the wing 2 from the top.
- **Not to model:** these appear only in promo images:
  - a brass hex centre nut
  - a dark wheel ring with many bolt dots
  - one smoky LED strip
  - AI-garbled decals (reseller image rc2-g14)

## Step 3: Measurements

See [`measurements.csv`](measurements.csv). Differences from the model of more than 5 mm or 15%:

| Measurement | Model | Online estimate |
|---|---|---|
| Tyre diameter | 72 | 60 ± 2 |
| Wheel ring | 50 | 33 ± 1 |
| Tyre width | 30 | 23 ± 2.5 |
| Body shell length | 205 | 149 ± 6 |
| Shell width at front axle | 76 | about 40 |
| Front bumper width | 86 | 44 ± 4 |
| Light bar width | 40 | about 30 |
| Ground clearance | 17 | about 25 |
| Overall length | 245 | 234 ± 9 (the seller's 245 is just outside) |

Within tolerance:

| Measurement | Model | Online estimate |
|---|---|---|
| Width | 145 | 141.5 ± 3 |
| Height | 95 | 93 ± 3 |
| Wheelbase | 150 | 146.5 ± 3 |
| Roof height | 88 | 92 ± 3 |
| Wing span | 95 | 90 ± 3 |

Not found online:
- shock length when compressed
- suspension travel
- steering lock
- weight

The steering lock can only be bounded. A top-down video shows the front wheels turning 17–25° between two states, so the lock each way is between 9° and 25°. The seller's "0–30°" graphic belongs to the DK068.

## Step 4: Remote

The remote is an angular pistol grip in black or graphite. It runs on 2 × AA cells (not included), which sit side by side in the grip behind a one-screw door on the left side.

- **Right side:** a 3-spoke press-on wheel about 43 mm across, a round "+" lights button and a small red LED behind it.
- **Left side:** an ON/OFF slide and the battery door.
- **Underneath:** a C-ring trigger and a long wedge foot with a decorative wheel (about 29 mm) at the rear.

**Two versions exist:**
- **Version A** has an antenna stub on top, a fork trigger and no visible slide switch. It appears in 2024 videos and in seller images, including your listing's g04.
- **Version B** has a flat top, a C-ring trigger and the ON/OFF slide. It is the one in ordinary 2025–26 buyer photos.

Expect version B. Both have the same buttons.

**Measurements,** scaled from the AA slots and the 14500 cell:

| Dimension | Estimate |
|---|---|
| Height | about 134 ± 8 mm |
| Length | about 117 mm |
| Head length | about 104 mm |
| Grip depth | about 40 mm |
| Trigger | hangs about 25 mm below the head; ring about 21 mm across |

Head width and grip width can't be measured from any photo online.

**The six questions:**
1. **Steering is not proportional.** It goes full left, centre or full right, on microswitches. Many buyers on six listings say so.
2. **The throttle is also on/off.** No brake or pause before reverse is documented.
3. **Wheel travel is small,** per buyers. The angle isn't documented, and spring return is inferred, not shown.
4. **Pushing the trigger away is reverse,** per the manual and the box.
5. **The LED is one red light, lit while the remote is on.** Blink patterns for pairing or low battery are not documented.
6. **There are no trim knobs and no speed switch.** The one button toggles the car's lights. The box calls this the fifth channel.

The seller's "full proportional throttle" and "dual speed" remote belongs to the sister DK068, not this car.

## Steps 5 and 6: Inside

- **Body removal:** screws come out from above, then the frame, panels and light bar lift off as one. Bumper, shocks and wing stay on the chassis. A thin wire stays connected, so the LED lead plugs into the chassis.
- **Electronics:** a long tub on top of the chassis between the axles, under a black box-shaped lid held by screws.
  - A green receiver board sits at its front.
  - Leads: red (looped), blue, yellow, white and red/white, plus a white 2-pin plug.
  - A copper coil along the right wall is probably the antenna.
  - Board size is very roughly 35–40 mm. Chip markings are unreadable.
- **Drive motor:**
  - Silver brushed can, about 15–16 mm in diameter, so 130 or 180 class. The "130" label comes only from seller text.
  - It sits crosswise in the right-hand lobe at the back of the gearbox, and slides out to the right once the octagon-rimmed cap is off.
- **Gearbox and axle:** one black housing with rigid axle tubes moulded on each side and white plastic stub axles in bushings. No bearings are visible.
- **Not found online:**
  - gearbox stages
  - tooth counts
  - pinion
  - gear colours
- **Steering:** a plain motor. A buyer says it slips a gear and doesn't always return to centre.
  - Tie rods are bent steel wire, probably two halves of about 31 mm each.
  - The underside dial with an R mark is a user steering trim.
  - The steering box itself was never photographed.
- **Battery:**
  - One 14500 Li-ion cell, 3.7 V 500 mAh. One label reads "YX IMR14500-500mAh 3.7V 1.85Wh" ([photo](https://ae-pic-a1.aliexpress-media.com/kf/Se11bce6a09774d0495a422112a4f93066.jpg)).
  - Black 2-pin SM-type plug on red/black leads.
  - It lies crosswise in an underside bay about 56 × 65 mm inside, under a one-screw cover. The bay fits two cells side by side.
  - It charges out of the car on a bare USB-A lead.
- **Power switch:** a red slide switch on the underside, at the front edge of the battery cover, on the car's left.
- **Lights:** 3 cool-white LEDs, switched from the remote. There are no rear LEDs, despite one seller line.
- **Chassis:** black ABS. The total screw count was not found.

## Step 7: Motion

- **Top speed:** every seller says 20 km/h, and your listing says "20+". No measured run exists online. One promo clip gives 19–27 km/h after a perspective correction, which suggests it was sped up. Buyers mostly say "not quite 20".
- **Run time:**
  - A stopwatch reads 23:08 at the end of one continuous run ([PKK9lpIAYLk](https://www.youtube.com/watch?v=PKK9lpIAYLk), at about 1416 s).
  - Buyers report 20–30 min.
  - Seller figures vary: 30 min, 15–18 min, and "45+" on your listing.
  - Charge time is 90 min (seller).
- **Steering speed and centring behaviour:** not found.
- **Partial substitutes for the Step 7 clips:**

  | Clip | Video and time | Notes |
  |---|---|---|
  | Wheels in the air | ed8tpJhneGY, 63–101 s | Rear wheel spinning; direction not visible |
  | Steering from above | 6GwEvUif_Ms, 579–604 s | |
  | Corner presses | ed8tpJhneGY 130–138 s, o9N3XDC3NYg 111–121 s | |
  | Rough ground | hQnjcsGtLEE, 185–292 s | |

  Gears in motion and a timed 10 m run don't exist online.

## Pitfalls in the online material

- **DK068:** the sister model DK068 shares listings with this car. It has a different shell, a 4-LED roof pod and the two-button remote. Many seller description images are DK068, including the "0–30° steering" and "proportional throttle" graphics.
- **Unreliable images:** several seller images are renders or AI-retouched, with brass nuts, garbled decals and smoothed light bars. Use real buyer photos for detail.
- **Unreliable reviews:** three reviews on your listing dated 11 Sep 2026 read like seeded boilerplate. One mentions "2 powerful motors", another a spare battery on a one-battery order.
- **Seller text is often wrong:**
  - "brushless"
  - "proportional acceleration"
  - "rear roof lighting"
  - "metal shock absorbers"

## Still needs the car

These can't be answered online. They are the most important things to measure when the car arrives:

- gearbox tooth counts, stages and shaft spacing
- motor can text, pinion, and how the wire colours map to the terminals
- receiver chip markings and board size
- the steering mechanism, including any potentiometer or centring spring
- shell panel thickness and mounting tabs
- shock lengths (extended and compressed) and suspension travel
- steering lock and steering speed
- weight
- remote head and grip widths
- LED blink patterns
- a timed 10 m run

## Notes on the brief

These still apply:

1. **Photos can't reach the 1 mm target, so the caliper table must.** At 1.5 m, the far side of the car appears about 10% smaller than the near side, and features at the ends shift about 6 mm. Scale each blueprint from caliper values measured in that view's plane, and treat photos as shape references. If a ruler sets the scale, put it at the car's centreline.
2. **3–4 hours is tight** for Steps 5–7 with before and after photos. Plan for 5–6 hours.
3. **Two measurements are missing from the brief:**
   - the shell's panel thickness
   - the centre distances between gear shafts, which you need to place the gears and can check against tooth counts

   The roll-cage tube row is moot: the cage is moulded with the body frame.
