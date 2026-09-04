# Elements

A periodic table that rearranges itself. Plain HTML, CSS and JavaScript — no build step, no
dependencies, no network calls. Once installed it works with the phone in airplane mode.

## Files

```
index.html              app shell
styles.css              all styling, light and dark
elements.js             the 118 elements + derived electron configurations
app.js                  views, search, filtering, detail sheet
sw.js                   service worker (offline cache)
manifest.webmanifest    install metadata
icons/                  192, 512 and maskable icons
```

## Running it

The service worker and the install prompt both need a real origin — `https://` or `localhost`.
Opening `index.html` straight off the filesystem works for browsing, but it will not install and
will not cache.

Quickest local server:

```bash
cd elements-pwa
python3 -m http.server 8000
```

Then open `http://localhost:8000` on the same machine, or
`http://<your-computer's-LAN-IP>:8000` from a phone on the same Wi-Fi. Note that Android will
usually refuse to install a PWA over plain `http://` from a LAN address; it needs HTTPS. For
phone installation, host it somewhere with a certificate. Any static host works — GitHub Pages,
Netlify drop, Cloudflare Pages, an S3 bucket, or a folder on a server you already run. Upload the
whole directory, keep the structure, done.

## Installing on a phone

- **Android / Chrome** — open the URL, then menu → *Install app* (or *Add to Home screen*). The
  in-app banner offers the same thing.
- **iOS / Safari** — open the URL, tap Share → *Add to Home Screen*. iOS ignores the install
  banner, so this is the only route. It still runs standalone and caches offline afterwards.

## Searching

The search box takes several kinds of input at once, space-separated.

| You type | You get |
| --- | --- |
| `iron`, `fe`, `26` | name, symbol or atomic number |
| `55.8` | the three elements nearest that mass, with the gap to each |
| `mass<20`, `mass>200` | a range |
| `en>3`, `mp<300`, `density>10`, `year>1950` | any numeric property |
| `group=15`, `period=4` | position on the chart |
| `mass~64` | within about 2% of 64 |
| `metal`, `nonmetal`, `metalloid` | how it behaves |
| `gas`, `liquid`, `solid` | phase at the current temperature setting |
| `radioactive`, `synthetic`, `natural` | provenance |
| `halogen`, `noble`, `alkali`, `transition` | family |
| `en>3 gas` | terms combine |

Press `/` anywhere to jump to the search box.

## The six views

- **Table** — the familiar chart. Tap *Fit to screen* to switch to larger cells with sideways scroll.
- **Sorted** — every element as a tile, reordered by whatever property you pick. The fastest way to
  answer "what's just heavier than this".
- **Ruler** — elements placed on a real number line, so the gaps are true to scale. Type a mass and
  a dashed marker appears at that value with the neighbours around it. Stretch to 8× to separate
  crowded regions like the lanthanides.
- **Plot** — any property against any other. Density against atomic number shows the osmium ridge;
  melting point against group shows the carbon spike.
- **Bonds** — pick an element and see what it pairs with, grouped into ionic, polar covalent,
  nonpolar covalent, alloys and inert, each with a predicted formula.
- **List** — dense sortable rows. Tap a column heading to sort by it.

## Paint and temperature

*Paint* recolours every view: by family, orbital block, metal/nonmetal, or as a heat map over mass,
electronegativity, melting point, density or year of discovery.

Choosing *Phase at T* reveals a temperature slider. Drag it and the table becomes a phase map —
at 234 K mercury freezes, by 3000 K most of the d-block has melted and tungsten is still solid.
The `gas` / `liquid` / `solid` search keywords follow the same slider.

## Notes on the data

Atomic masses are IUPAC standard atomic weights, rounded; for elements with no stable isotope the
value is the mass number of the most stable one. Electron configurations are generated from the
Madelung filling order with the known ground-state exceptions applied, so chromium, copper, gold
and the early actinides come out right rather than idealised.

Predicted formulas in the Bonds view come from the usual charges plus the Pauling
electronegativity gap. They are a reasonable first guess, not a claim about what actually forms —
real chemistry depends on conditions, and many pairs form several compounds.

To edit the data, change the table at the top of `elements.js`. Each row is
`number|symbol|name|mass|category|group|period|electronegativity|melt K|boil K|density|charges|year`,
and a blank field means unknown. Bump `CACHE` in `sw.js` afterwards so phones pick up the change.
