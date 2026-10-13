# Shuttle 08 Workshop

An interactive 3D model of a toy RC buggy, made to show a young child how the car works inside. You drive it from an on-screen remote, take it apart, and watch the motor, gears, steering and springs move.

**Live site:** https://harell.github.io/buggy/ (after GitHub Pages is switched on, see [Publishing](#publishing-on-github-pages))

The car is a generic blue "SHUTTLE 08 / WILD ROAD" 1:16 off-road buggy: 2WD, 2.4 GHz radio, a 3.7 V rechargeable battery and an alloy body shell.

## What you can do

| Area | How it works |
| --- | --- |
| Remote (left) | Fixed view. Drag its wheel to steer and hold its trigger to drive. The Forward / Back / Left / Right buttons and the arrow keys (or WASD) do the same. **Keep going** drives forward without holding. |
| Car (right) | Drag to spin, scroll or pinch to zoom, right-drag to slide. The car stays in place while the dirt track moves under it. |
| Take it apart | A button and a slider spread the parts out into an exploded view. Every part keeps moving while it is apart. |
| Look closer | Engine, Gears, Battery, Brain, Steering, Springs, Wheels, Lights, Wires, Frame or Body. The rest of the car turns see-through, the part glows and the camera moves to it. A short explanation for children and a note for grown-ups appear underneath. You can also tap a part in 3D. |
| Springs demo | **Bumpy road** turns the track into gravel. **Lock the springs** bolts the body to the wheels so the whole car shakes. A live graph compares one wheel's bumps with how the body above it rides. |
| Extras | The wires glow in the direction electricity flows, and the glow reverses when you back up. A strip shows the path a command takes (Remote › Radio › Brain › Motor › Gears › Wheels). There is also a speedometer, slow motion, motor sound and light/dark themes. |

Keyboard shortcuts: arrows / WASD to drive, `L` toggles the lights, `E` takes the car apart or puts it back together.

## Running it

It is a single static page with no build step.

- **Online:** open the GitHub Pages link above.
- **Locally:** open `index.html` in a browser, or serve the folder (`python3 -m http.server`) and open `http://localhost:8000`.

It needs an internet connection: Three.js 0.160 loads from jsDelivr and the fonts from Google Fonts. It needs a browser with WebGL (any current Chrome, Edge, Firefox or Safari).

## Publishing on GitHub Pages

The site is served straight from the `main` branch, with no workflow needed:

1. Merge the pull request into `main`.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, then **Branch** to `main` and folder `/ (root)`. Save.
4. After a minute or two the site is live at https://harell.github.io/buggy/.

`.nojekyll` tells Pages to serve the files as they are, without running them through Jekyll.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app: page, styles, the procedural 3D model (Three.js) and the interaction code |
| `README.md` | This file |
| `.nojekyll` | Turns off Jekyll processing on GitHub Pages |

## How accurate is the model?

- **Outside:** shape, colours and proportions come from the seller's photos and size chart (24.5 × 14.5 × 9.5 cm). The car is modelled in code from simple shapes, so curves are approximate.
- **Inside:** nobody publishes schematics for this toy. The layout follows a [published teardown of a near-identical 1:16 toy buggy](https://github.com/slackhappy/rccar). That buggy has a 2.4 GHz receiver chip, a MOSFET H-bridge for the drive motor, a separate driver chip for the steering motor, a rear motor with a gearbox, and coil-over shocks at each corner.
- **Illustrative, not measured:** the gear ratio (8:28 then 10:30, about 10.5 : 1), the steering rack geometry and the exact part sizes.
- **Checked and not used:** the Dikavey BX12, MJX 16208/16209/16210 and Traxxas 1/16–1/18 manuals. They describe hobby-grade 4WD cars with servos, speed controllers and differentials, not this toy.

A research brief lists the photos and measurements needed to make the model match the real car exactly.
