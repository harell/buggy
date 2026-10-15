# Shuttle 08 Teardown

An interactive 3D teardown of a toy RC buggy. The car drives on rough ground the whole time, and you choose what to show: light up any component or set of components, take parts off the car, or pull the whole car apart. It is meant to replace a screwdriver when you want to show someone how the car is built and how its parts work together, in whatever order the conversation goes.

**Live site:** https://harell.github.io/buggy/ (after GitHub Pages is switched on, see [Turning on GitHub Pages](#turning-on-github-pages-once))

The car is a 1:16 toy buggy sold as the DK087 (factory no. 3699-087), shown in blue with its "SHUTTLE 08" and "WILD ROAD" decals. It has rear-wheel drive, a 2.4 GHz radio with on/off throttle and steering, one 3.7 V 14500 lithium-ion cell, and painted metal panels on a black plastic frame.

## What you can do

There are no keyboard shortcuts and no script: every control is on screen.

| Area | How it works |
| --- | --- |
| Parts (left) | Twenty components in five sets: body and frame, suspension, drivetrain, steering and electrics. Click a name to light it up: it stays solid and everything else turns see-through. Click more names to light up several, or click a set's heading to light up the whole set. The eye takes a component (or a whole set) off the car, and clicking it again puts it back. A covered part opens its cover when it is lit up: the gearbox for the gears and motor, the motor can for its rotor, the tub lid for the receiver. Hover a name for one line of facts. **Reset** puts everything back. Clicking a part in 3D, or its name tag, lights it up or turns it off. |
| Viewpoints (top right) | 3/4, Side, Front, Rear and Top. Side is low, at wheel height: the view for watching the shocks against the frame. The camera frames whatever is lit up, and you can drag to orbit and scroll to zoom. |
| Motion (bottom) | **Driving** (on from the start): the car drives forward by itself. **Weave** steers full left and right in turn, so the steering works. **Rough ground** switches between gravel and a smooth track. **Springs locked** bolts the body to the wheels, for comparing with working springs on the same ground. **Slow-mo** slows everything down. **Ride trace** graphs the front-left wheel's bumps against the body above it. |
| Together ↔ Apart | Spreads the parts out into an exploded view. While the car is apart it sits on a stand: the wheels, motor and gears keep turning, but the springs rest. |
| Springs | Each spring glows orange as it is squeezed, while the shocks are shown solid. |
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
| `src/core/` | Pure logic: dimensions, terrain height field, driving model, suspension, gear and rack kinematics, ride meter, label layout, parts and the bench's components and sets (`components.ts`) | Yes, `tests/*.test.ts` |
| `src/model/` | Procedural 3D model: geometry builders (tested), the car's fixed mount points and outlines (`mounts.ts`, tested), materials and part registry (which component each mesh belongs to, lighting up, removing, cutaways, shadows), canvas textures, the car | Geometry builders, mount points and the part registry |
| `src/scene/` | Three.js scene: renderer and camera (with the sideways shift that keeps the car clear of the parts panel), the moving ground, posing the car each frame (including the spring glow) | Visually |
| `src/ui/` | DOM pieces: name tags and the ride trace | Visually |
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

The model follows online research on the real DK087 (factory no. 3699-087). [`research/README.md`](research/README.md) has the findings and sources; nobody here has the car yet.

- **Sizes:** every size is a constant in `src/core/dims.ts`, measured from buyer photos and scaled from one photo of the car on a 1 cm cutting mat. [`research/measurements.csv`](research/measurements.csv) gives each value's source and uncertainty (mostly ±1–6 mm) and the constant that uses it. The car comes out at about 22.9 × 14.2 × 9.3 cm. The seller's 24.5 × 14.5 × 9.5 cm is not a measurement. Nothing has been checked with a caliper yet.
- **Shape and parts:** taken from photos of real cars, not seller renders, and from a stock teardown video. That covers the 6 cm tyres and 5-spoke rims with a grey ring, the painted panels screwed to a moulded frame, the one lower arm per side at the front, the live rear axle with the motor lying across it, the battery bay and power switch under the car, the receiver board with its coil antenna, the 3-LED light bar and the remote.
- **Still illustrative:** the gear tooth counts and ratio (8 → 28, then 10 → 30, about 10.5 : 1), since no photo shows the gears; the steering motor, gears and rack, since the steering box was never photographed; the receiver board's chips and layout; which wire goes where; spring stiffness and travel; and the exact curves, since the car is built in code from simple shapes.
- **Checked and not used:** the first version of the model followed a [teardown of a similar 1:16 toy buggy](https://github.com/slackhappy/rccar). The DK087's own photos replace it. The Dikavey BX12, MJX 16208/16209/16210 and Traxxas 1/16–1/18 manuals describe hobby-grade 4WD cars with servos, speed controllers and differentials, not this toy.

[What still needs the car](research/README.md#still-needs-the-car) lists what to measure when it arrives: gear tooth counts, the steering box, board chips, shock travel, steering lock and weight.
