# Smash Karts Arena 🏎️💥

Een browser-based 3D kart battle game in de stijl van [Smash Karts](https://smashkarts.io) /
Mario Kart battle mode. Rijd rond in een kleurrijke arena, pak **?**-boxen en schakel de
andere karts uit met power-ups. Speelbaar op desktop (toetsenbord) én mobiel (touch controls).

## Spelen

De game is pure statische HTML/JS (Three.js, geen build-stap). Start een statische webserver
in de projectmap:

```bash
# met Python
python3 -m http.server 8000

# of met Node
npx serve .
```

Open daarna `http://localhost:8000` in je browser. Voor mobiel: open hetzelfde adres op je
telefoon binnen hetzelfde netwerk (bijv. `http://<ip-van-je-computer>:8000`), of host de map
op een statische host (GitHub Pages, Netlify, …).

> ⚠️ Direct openen via `file://` werkt niet — ES-modules vereisen een webserver.

## Besturing

| | Desktop | Mobiel |
|---|---|---|
| Rijden | Pijltjes of WASD | Automatisch gas; joystick links = sturen, joystick omlaag = remmen/achteruit |
| Schieten / item gebruiken | Spatie | Grote blauwe knop rechtsonder |

## Gameplay

- **Match van 3 minuten** tegen 7 AI-tegenstanders; wie de meeste kills heeft wint.
- **?-boxen** geven een willekeurige power-up:
  - 🔫 **Machinegeweer** — 14 snelle kogels (1 schade)
  - 🚀 **Raketten** — 3 licht-sturende raketten (3 schade, splash + knockback)
  - 💣 **Mijnen** — 3 mijnen die je achter je dropt
  - 🛡️ **Schild** — 5 seconden onkwetsbaar + sneller
- **6 hitpoints**; bij 0 ontplof je en respawn je na een paar seconden met korte
  spawn-bescherming.
- Ramps in de arena om overheen te springen, een centraal plateau met item-box,
  leaderboard, killfeed en FPS-teller zoals in het origineel.

## Techniek

- [Three.js](https://threejs.org) (lokaal in `vendor/`, dus geen CDN nodig)
- Vanilla ES-modules, geen bundler of dependencies
- Synthetische geluidseffecten via WebAudio (geen audiobestanden)
- AI-bots met doelzoek-, ontwijk- en vastzit-gedrag simuleren de multiplayer-ervaring

### Bestandsstructuur

```
index.html        entrypoint + HUD/overlay markup
style.css         HUD, touch controls en overlays
src/main.js       game-loop, camera, matchverloop
src/world.js      arena, ramps, botsingen & terreinhoogte
src/kart.js       kart-mesh, rijfysica, respawn
src/items.js      item-boxen, wapens, projectielen, mijnen, schade
src/bots.js       AI-tegenstanders
src/input.js      toetsenbord + touch (joystick/vuurknop)
src/hud.js        leaderboard, health, timer, killfeed
src/effects.js    particles & camera shake
src/audio.js      synthetische sound effects
vendor/           three.module.js
```
