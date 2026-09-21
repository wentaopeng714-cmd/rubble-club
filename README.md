# Rubble Club

**Small crew. Big crunch.** A colorful toy-like demolition game for desktop and mobile browsers. Hit the striped ground-floor supports, bring down the rooms above, and let your little truck collect the rubble.

- [Play online](https://wentaopeng714-cmd.github.io/rubble-club/)
- [Download the ZIP](https://github.com/wentaopeng714-cmd/rubble-club/releases/download/v1.0.0/rubble-club-v1.zip)

## Play

- Tap / click a building module to strike it. Yellow striped ground-floor supports create the biggest chain reactions.
- Drag the scene, use the rotate buttons, or press Left / Right to see the back of the building.
- Choose tools with the cards or keys **1 / 2 / 3**.
- **P / Escape** pauses. Switching tabs also pauses an active job.
- Clear the entire building before energy runs out. On protected sites, keep the pink neighboring shop at **75% or more**.
- Clear a site to earn coins and unlock the next. Best stars, unlocked sites, upgrades and coins are saved in the current browser. An in-progress job restarts on refresh.

## Tools and upgrades

| Tool | Energy | Unlock | Effect |
| --- | ---: | --- | --- |
| Breaker | 1 | Available from the start | A precise hit on one module |
| Wrecking ball | 3 | Clear site 2 | Damages nearby modules within a wider swing |
| Dynamite | 4 | Clear site 4 | A delayed blast over a larger area |

The workshop offers three permanent upgrade paths, each capped at level three:

- **More muscle:** +22% damage per level.
- **Wider swing:** larger ball and dynamite impact areas; large blasts require care near the neighbor.
- **Happy hauler:** +15% job pay per level and faster rubble collection.

Failed jobs are free to retry. Replaying a completed site provides a smaller reward; the first clear pays more. You can complete the whole career using only coins earned along the way.

## Nine sites

| Site | District | Floors | Energy | 3-star time |
| --- | --- | ---: | ---: | ---: |
| Peach Corner | Coral Quarter | 2 | 12 | 30 s |
| Bluebell Bakery | Bluebell Block | 3 | 13 | 34 s |
| Lemon Arcade | Citrus Square | 3 | 18 | 38 s |
| Mint & Co. | Garden District | 3 | 19 | 40 s |
| Apricot Hotel | Sunset Avenue | 4 | 22 | 43 s |
| Violet Works | Lilac Lane | 4 | 24 | 46 s |
| Poolside Plaza | Turquoise Terrace | 4 | 28 | 49 s |
| Candy Heights | Pink Skyline | 5 | 30 | 53 s |
| The Grand Crunch | Confetti District | 5 | 32 | 57 s |

Sites 4 and 6–9 have a protected neighbor. Later sites use stronger supports, including reinforced corners. One star means a successful clear; two require at least 95% neighbor safety; three additionally require meeting the time target and saving at least 15% of the initial energy, rounded down. The clock starts with the first strike.

## Physical behavior and feedback

Rapier simulates falling rooms and rubble. A simple column-support graph determines which rooms lose their supports; the model is designed for a readable arcade game, not structural engineering. Unsupported rooms become dynamic rigid bodies and fragment when they land or after a short fallback timeout. Rubble collision forces and nearby area attacks can damage the neighbor.

Feedback includes excavator-arm strikes, a swinging ball, a thrown dynamite bundle, cracks, impact pauses, colored chips, rolling blocks, chain counters, collection arcs, sound effects and celebration confetti. Colors change between districts: coral, lake blue, lemon yellow, mint, lilac and candy pink. All geometry and interface graphics are generated locally; there are no external art downloads or APIs.

## Run locally

With Python 3 installed, macOS users can double-click `启动游戏.command`. Alternatively:

```sh
python3 -m http.server 4194 --directory dist
```

Open http://localhost:4194/. Use an HTTP server; opening index.html as a local file is not supported.

For development, use Node.js 22.18 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` contains the production build with all dependencies included. GitHub Pages serves `docs/` from the main branch. To update it, replace docs with the latest dist contents and retain `.nojekyll`.

## Validation

Ten rule tests cover column collapse, energy and cooldown limits, tool unlocks, finishing on the last hit, pausing a pending explosion, area attacks, neighboring-building failure, upgrade limits and save validation, earned-coin progression through all nine sites, reward rules, and increasing site strength. Browser checks cover direct support targeting, cracking and collapse, a full clear and reward receipt, workshop purchases, explosion previews, and mobile layout.

`tests/preview.html` is a development-only visual preview; it is not included in the production website. Third-party licenses for Three.js and Rapier are bundled under `public/licenses/` and `dist/licenses/`.
