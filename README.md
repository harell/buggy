# Shuttle 08 Workshop

An interactive 3D model of a toy RC buggy, made to show a young child how the car works inside. You drive it from an on-screen remote, take it apart, and watch the motor, gears, steering and springs move.

**Live site:** https://harell.github.io/buggy/ (after GitHub Pages is switched on, see [Turning on GitHub Pages](#turning-on-github-pages-once))

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

## Development

Built with TypeScript, [Three.js](https://threejs.org/) (from npm), [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/). Needs Node 20 or newer.

```bash
npm install       # once
npm run dev       # local dev server with hot reload
npm test          # unit tests (Vitest)
npm run typecheck # TypeScript, strict mode
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

It needs a browser with WebGL (any current Chrome, Edge, Firefox or Safari). Fonts load from Google Fonts. Everything else is bundled.

### How the code is organised

The logic that decides how the car behaves is kept free of rendering and DOM code, so it can be unit-tested. The 3D model and UI are thin layers on top.

| Folder | What lives there | Tested |
| --- | --- | --- |
| `src/core/` | Pure logic: dimensions, terrain height field, controls, driving model, suspension, gear and rack kinematics, ride meter, label layout, signal-path strip, part catalogue | Yes, `tests/*.test.ts` |
| `src/model/` | Procedural 3D model: geometry builders (tested), materials and part registry, canvas textures, the car | Geometry builders |
| `src/scene/` | Three.js scene: renderer and camera, the moving ground, the remote, radio rings, posing the car each frame | Visually |
| `src/ui/` | DOM pieces: labels, signal-path strip, ride graph, sound | Visually |
| `src/main.ts` | Wires it all together and runs the frame loop | Visually |

New behaviour starts as a failing test in `tests/`, then the code that makes it pass.

## CI/CD

Two GitHub Actions workflows live in `.github/workflows/`:

| Workflow | When it runs | What it does |
| --- | --- | --- |
| `ci.yml` | Every pull request and every push to `main` | `npm ci`, typecheck, tests, production build |
| `deploy.yml` | Every push to `main` (merging a PR), or by hand from the Actions tab | Tests and builds, then publishes `dist/` to GitHub Pages. It never deploys a build whose tests fail |

`main` is the production branch: changes reach it only through pull requests.

### Turning on GitHub Pages (once)

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Merge a PR into `main` (or run *Deploy to GitHub Pages* from the Actions tab). The site goes live at https://harell.github.io/buggy/.

Recommended: in **Settings → Branches**, protect `main` so that it requires a pull request and the **CI / Typecheck, test and build** check before merging.

## How accurate is the model?

- **Outside:** shape, colours and proportions come from the seller's photos and size chart (24.5 × 14.5 × 9.5 cm). The car is modelled in code from simple shapes, so curves are approximate.
- **Inside:** nobody publishes schematics for this toy. The layout follows a [published teardown of a near-identical 1:16 toy buggy](https://github.com/slackhappy/rccar). That buggy has a 2.4 GHz receiver chip, a MOSFET H-bridge for the drive motor, a separate driver chip for the steering motor, a rear motor with a gearbox, and coil-over shocks at each corner.
- **Illustrative, not measured:** the gear ratio (8:28 then 10:30, about 10.5 : 1), the steering rack geometry and the exact part sizes.
- **Checked and not used:** the Dikavey BX12, MJX 16208/16209/16210 and Traxxas 1/16–1/18 manuals. They describe hobby-grade 4WD cars with servos, speed controllers and differentials, not this toy.

A research brief lists the photos and measurements needed to make the model match the real car exactly.
