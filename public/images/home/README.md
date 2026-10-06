# Homepage artwork

- `osrs-logo.webp`: Old School RuneScape logo, © Jagex, downloaded from the [OSRS Wiki](https://oldschool.runescape.wiki/w/File:Old_School_RuneScape_logo.png). Resized to 800px wide and encoded as WebP with its transparency preserved. Retained as an unused asset; the homepage no longer displays it.
- `grand-exchange.webp`: original OSRS-inspired fan illustration generated with the built-in imagegen tool, then encoded as WebP. This is an illustrative scene, not a screenshot or market-data display.
- `grand-exchange-sunset.webp`: original 1672 × 941 sunset background, generated with the built-in imagegen tool using `grand-exchange.webp` as a visual reference, then encoded as WebP at quality 86. An OSRS-inspired fan illustration of the Grand Exchange beneath a golden sunset; not an in-game screenshot.
- `grand-exchange-sunset-4k.webp`: current homepage background, 3840 × 2160. The built-in imagegen tool enhanced the sunset illustration but returned 1672 × 941 pixels; Sharp then enlarged it with Lanczos3 interpolation and gentle sharpening (`sigma: 0.6, m1: 0.5, m2: 1`) and encoded it as WebP at quality 90. This is an upscaled illustration, not native 4K detail. The homepage uses Next.js responsive image sizes through 3840px at quality 90; smaller screens receive smaller variants.

## Floating item icons

The transparent PNGs in `items/` are original OSRS inventory artwork, © Jagex, downloaded unchanged from the OSRS Wiki. They appear in decorative glass tiles on the welcome page and are served locally without market-data requests.

| Local file | Wiki source |
| --- | --- |
| `items/dragon-scimitar.png` | [Dragon scimitar](https://oldschool.runescape.wiki/w/File:Dragon_scimitar.png) |
| `items/abyssal-whip.png` | [Abyssal whip](https://oldschool.runescape.wiki/w/File:Abyssal_whip.png) |
| `items/dragon-boots.png` | [Dragon boots](https://oldschool.runescape.wiki/w/File:Dragon_boots.png) |
| `items/rune-platebody.png` | [Rune platebody](https://oldschool.runescape.wiki/w/File:Rune_platebody.png) |
| `items/shark.png` | [Shark](https://oldschool.runescape.wiki/w/File:Shark.png) |
| `items/prayer-potion.png` | [Prayer potion (4)](https://oldschool.runescape.wiki/w/File:Prayer_potion%284%29.png) |
| `items/nature-rune.png` | [Nature rune](https://oldschool.runescape.wiki/w/File:Nature_rune.png) |
| `items/twisted-bow.png` | [Twisted bow](https://oldschool.runescape.wiki/w/File:Twisted_bow.png) |
| `items/dragon-dagger.png` | [Dragon dagger](https://oldschool.runescape.wiki/w/File:Dragon_dagger.png) |
| `items/amulet-of-fury.png` | [Amulet of fury](https://oldschool.runescape.wiki/w/File:Amulet_of_fury.png) |
| `items/berserker-ring.png` | [Berserker ring](https://oldschool.runescape.wiki/w/File:Berserker_ring.png) |
| `items/fire-rune.png` | [Fire rune](https://oldschool.runescape.wiki/w/File:Fire_rune.png) |
| `items/blood-rune.png` | [Blood rune](https://oldschool.runescape.wiki/w/File:Blood_rune.png) |
| `items/magic-logs.png` | [Magic logs](https://oldschool.runescape.wiki/w/File:Magic_logs.png) |
| `items/rune-scimitar.png` | [Rune scimitar](https://oldschool.runescape.wiki/w/File:Rune_scimitar.png) |
| `items/saradomin-brew.png` | [Saradomin brew (4)](https://oldschool.runescape.wiki/w/File:Saradomin_brew%284%29.png) |
| `items/granite-maul.png` | [Granite maul](https://oldschool.runescape.wiki/w/File:Granite_maul.png) |
| `items/dark-bow.png` | [Dark bow](https://oldschool.runescape.wiki/w/File:Dark_bow.png) |
| `items/bandos-chestplate.png` | [Bandos chestplate](https://oldschool.runescape.wiki/w/File:Bandos_chestplate.png) |
| `items/armadyl-helmet.png` | [Armadyl helmet](https://oldschool.runescape.wiki/w/File:Armadyl_helmet.png) |

## Background generation

Original background generation prompt:

> Create a wide landscape website hero background image, 1536x1024. An atmospheric original fan illustration inspired by Old School RuneScape's Grand Exchange near Varrock. Faithfully evoke the charming 2007 low-poly game aesthetic: an open octagonal cream stone trading pavilion with crimson fabric roofs, bank booths, medieval flags, small low-poly adventurers trading on cobblestone paths, dark pine and broadleaf trees and the stone walls of Varrock in the background. Isometric aerial perspective, like an evocative screenshot rendered with flat-shaded polygons, NOT realistic, NOT modern high fantasy. Muted olive-green dusk, warm golden lantern lights, parchment-colored stone, rust red roof accents. Detailed and recognizable old-school game atmosphere. Composition: main trading pavilion on the RIGHT HALF and center-right, dark trees and quiet empty landscape on LEFT THIRD for text overlay. Sky a narrow band at top, cinematic beautiful warm dusk. No text, letters, interface, watermarks, logos, borders, charts or UI. The scene fills the entire image edge to edge. Save the final image locally so it can be used in the current website project.

Sunset background generation prompt:

```text
Use case: stylized-concept.
Asset type: fullscreen website homepage background, wide landscape 16:9.
Primary request: Old School RuneScape's Grand Exchange at sunset.
Input image 1: reference for the existing homepage's low-poly OSRS-inspired aesthetic and Grand Exchange subject.
Scene: the Grand Exchange near Varrock, its open cream-stone octagonal trading pavilion with crimson roof accents, central trading booths, cobblestone plaza, small low-poly adventurers, surrounding trees and distant Varrock walls.
Style: charming flat-shaded low-poly old-school game illustration, recognizable OSRS atmosphere.
Composition: a cinematic wide view with the trading pavilion centered in the lower half and a generous sunset sky in the upper third. The setting sun should be visible near the center of the horizon so it remains visible when the image is cropped for mobile. Keep the central area calm enough for the site's existing headline and button overlay.
Lighting: an unmistakable, vivid golden-hour sunset, a large low sun, glowing amber and peach clouds, warm golden light on cream stone and red roofs, long soft shadows, gently glowing lanterns. Make the image visibly brighter and warmer than the reference, while retaining depth and readable architecture.
Constraints: only the scene, edge-to-edge. No text, logos, UI, borders, or watermark.
```

Upscale prompt (built-in imagegen):

```text
Use case: precise-object-edit.
Asset type: existing fullscreen website background, upscale to 4K, 3840 × 2160 pixels.
Input image 1: the exact image to upscale.
Primary request: upscale this existing Grand Exchange sunset illustration to 3840 × 2160 pixels for sharper presentation on large desktop monitors.
Constraints: preserve the entire existing composition, framing, aspect ratio, viewpoint, architecture, every character and object placement, sunset sun position, clouds, lighting, colors, and charming flat-shaded low-poly OSRS-inspired style. This is a faithful resolution enhancement, not a redesign. Improve definition of existing stonework, roof edges, trees, cobblestones, and small figures without adding or removing objects or inventing a new scene. No crop, no reframing, no text, no watermark, no UI. Output a full-resolution 4K image.
```
