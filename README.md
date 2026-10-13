# Shuttle 08 Workshop

An interactive 3D model of a generic 1:16 "SHUTTLE 08 / WILD ROAD" 2WD RC buggy and its 2.4 GHz pistol-grip remote, made to explain to a young child how the car works.

Open `index.html` in a browser. It loads Three.js 0.160 and Google Fonts from CDNs. Nothing else is needed.

## What it does

- **Remote (left, fixed view):** drag its wheel to steer and hold its trigger to drive. Big hold-buttons and the arrow keys / WASD do the same. "Keep going" drives forward hands-free.
- **Car (right):** drag to orbit, scroll or pinch to zoom, right-drag to pan. The car stays in place while the dirt track slides under it. Bumps in the track work the shock absorbers.
- **Take it apart:** the button or slider spreads the parts out into an exploded view. Every part keeps moving while it is apart.
- **Look closer:** Engine, Gears, Battery, Brain, Steering, Springs, Wheels, Lights, Wires, Frame, Body. Picking one makes everything else see-through, gives that part a soft glow, moves the camera to it and shows a kid-level explanation plus a note for grown-ups. The motor can and the receiver housing become see-through when picked.
- **Wires** glow in the direction current flows. It flips when you reverse.
- **Drive / Steer path** strip shows how a signal travels: remote › radio › brain › motor › gears › wheels.
- **Slow-mo** turns on automatically for the take-apart view and the gear-heavy parts, so the gears don't blur.

## Sources and assumptions

- **Outside shape, colours and size** come from the AliExpress listing photos (item 1005013036812072): 24.5 × 14.5 × 9.5 cm, alloy shell, LED roof bar, 2WD, 2.4 GHz, 20 km/h, single 3.7 V Li-ion cell with an SM-2P plug, USB charging.
- **Internals:** no schematics exist for this toy. The layout follows a published teardown of a near-identical 1:16 toy buggy (https://github.com/slackhappy/rccar). That car has a 2.4 GHz receiver chip, a MOSFET H-bridge for the drive motor, a separate driver for the steering motor, a rear motor with a gearbox, and coil-overs on all four corners.
- **Gear ratio** (8:28, then 10:30 ≈ 10.5:1) and the exact steering rack geometry are illustrative.
- **Manuals checked and not used:** the Dikavey BX12, MJX 16208/16209/16210 and Traxxas 1/16–1/18 exploded views are hobby-grade 4WD cars (servo, ESC, differentials), so they don't describe this toy.
