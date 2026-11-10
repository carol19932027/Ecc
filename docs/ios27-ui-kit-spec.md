# Apple iOS 27.1.3 UI Kit & Siri Sphere — Complete Design System & Optical Physics Specification

> **Sources:** `Apple iOS 27 UI Kit.sketch` (Sketch `2026.3.1` build `234013`, released **2026-10-26**, version **27.1.3**), `apple-ios-27-ui-kit.tokens.json` (W3C Design Tokens, `402` leaf tokens across `25` categories), and `siri-sphere.zip` (`"Aurora Orb"` React 19 + Three.js WebGL shader prototype).
>
> **Companion Machine-Readable Artifacts:**
> - `dashboard/public/ios27-tokens.json` (full resolved tokens, all 42 layer styles, all 107 swatches, all 105 text styles, all 36 page specs, interactive optical lens rules)
> - `docs/apple-ios-27-ui-kit.tokens.json` (verbatim W3C Design Tokens JSON)

---

## 1. Kit Inventory & Release History (`27.0.0` → `27.1.3`)

| Metric | Count / Value | Notes |
|---|---:|---|
| Sketch Format | Sketch `2026.3.1 (234013)` | Optical `type: 4` Liquid Glass + `corners.style: 1` continuous squircles |
| Pages | 36 | Foundation (`P1–P8`), System (`P9–P10`), Components (`P11–P34`), Changelog & Kit (`P35–P36`) |
| W3C Design Tokens | 402 | `25` top-level groups (`System Colors`, `Materials`, `Liquid Glass`, `Controls`, `Typography`, etc.) |
| Shared Color Swatches | 107 | Light / Dark / Vibrant / Liquid Glass / Grays / Fills / Overlays |
| Shared Layer Styles | 42 | Backgrounds, Materials, Liquid Glass (Clear, Regular, Tinted, Dock, App Library, Keyboard, Widget, Lock Screen Time) |
| Shared Text Styles | 105 | `35` Default + `35` Loose Leading (`+2pt`) + `35` Tight Leading (`-2pt`) across `11` Dynamic Type roles |
| Optical Blur/Glass Instances | 672 | `65` unique blur signatures including inline interactive lens knobs (`r=0`) |

### Key Changes (`27.0.0` → `27.1.3`)
- **27.1.3 (2026-10-26):** Updated **Determinate Progress Indicators** bar thickness to **`4pt`**; added new **iPad Pro (M5) 11" & 13"** bezels and **iPhone Duo** support across Layout Guides, Status Bars, App Icons, Split View, Popovers, Toolbars, Sheets, Sidebars, Alerts, Menus, Tab Bars, and Keyboards.
- **27.1.x:** Added **iPhone 18 Pro** (`402×874`), **iPhone 18 Pro Max** (`440×956`), **iPhone Air** (`420×912`), **iPad mini (A17 Pro)** (`1133×744`), **58pt / 60×4px Sheet Grabber** widening, **32pt iPad Sheet radius**, **Glass / Glass Prominent / Destructive capsule buttons**, and **Scroll Edge Effect** (`Top - Hard` / `Top - Soft`).

---

## 2. Device Frame & Layout Matrix

| Device | Logical Viewport (pt) | Notes / Special Metrics |
|---|---:|---|
| **iPhone 18 Pro** | `402 × 874` | Primary iPhone design frame, Status Bar height `62pt` |
| **iPhone 18 Pro Max** | `440 × 956` | Max iPhone canvas, Status Bar height `62pt` |
| **iPhone Air** | `420 × 912` | Thin chassis bezel frame |
| **iPhone Duo (Inner Open)** | `951 × 669` (Landscape) / `669 × 951` (Portrait) | **`40pt` central hinge/fold zone**, 60×60 icons, side-by-side Tab Bar & Keyboards |
| **iPhone Duo (Outer Closed)** | `678 × 466` (Landscape) / `466 × 678` (Portrait) | Compact cover screen, `48×83` / `98×48` rotated status bars |
| **iPad mini (A17 Pro)** | `1133 × 744` | Landscape bezel frame |
| **iPad Pro (M5) 11"** | `1210 × 834` | Primary iPad design frame, `32pt` Status Bar + Menu Bar |
| **iPad Pro (M5) 13"** | `1376 × 1034` | Large iPad multitasking frame |

---

## 3. Liquid Glass & Optical Physics Engine (`blur.type = 4` vs `type = 3`)

Apple iOS 27 introduces a dedicated **Optical Refraction Glass shader (`blur.type: 4`)** alongside classic **Material Gaussian Backdrop Blur (`blur.type: 3`)** and **Gaussian Elevation Shadows (`blur.type: 0`)**.

### 3.1 Optical Parameters Explained
- **`radius`**: Gaussian blur radius in points (`0` = crystal-clear magnifying refraction lens, `3–6` = Dock/Small pill, `15–30` = Medium/Large sheets & dialogs, `45–75` = Background Materials, `100` = Soft Scroll Edge).
- **`saturation`**: Color vibrance multiplier behind glass (`1.0` neutral Dark, `1.208–1.455` Materials, `2.0` Light Small Glass!).
- **`brightness`**: Luminance boost (`1.0` standard, **`1.20` on Dark Pressed Knobs** to make dark interactive lenses pop optically).
- **`distortion`**: Barrel/edge lens refraction strength (`0.075–0.08` on tactile knobs, `0.2` on Clear/Dock, `0.3` on Medium/Large sheets, `0.4` on Small pills & Hard Scroll Edge).
- **`chromaticAberrationMultiplier`**: Edge spectral dispersion (`0.4` on Dark Interactive Lens Knobs, `0` on Light knobs / standard surfaces).
- **`depth`**: Simulated optical thickness of the glass slab (`0.4` tactile knobs, `0.5` Clear, `0.8` Small/Scroll Edge, `0.9` Medium/Large).
- **`corners`**: Continuous Apple squircle corners (`style: 1`, `smoothing: 0.6`, `prefersConcentric: true`), with capsule pills using `radius: ["inf"]` or `[100]`.
- **Scroll Edge Effects** (Page 9 System):
  - **`Top - Hard`**: `h = 112pt`, `blur(type: 4, r: 6, distortion: 0.4, depth: 0.8)` + `0.67pt` bottom hairline separator.
  - **`Top - Soft`**: `h = 77pt`, `blur(type: 3, r: 100, saturation: 1)` with progressive linear gradient alpha mask fading content softly into the top safe area.

### 3.2 Tactile Interactive Pressed Lens Knob (Inline Optical Glass)
Whenever a user presses or drags a **Toggle (`59×37` / `58×38`)**, **Slider (`57×38`)**, or **Segmented Control thumb (`59×37`)**, the solid white `38×24` / `37×24` idle pill expands and morphs into a transparent refracting glass droplet:

| State / Theme | Blur Type | Radius | Brightness | Distortion | Chromatic Aberration | Depth | Rim Glow & Shadow Stack |
|---|---|---:|---:|---:|---:|---:|---|
| **Pressed Lens — Dark** | `type: 4` | `0` (clear) | `1.20` | `0.08` | `0.40` | `0.40` | `1px #000000@0.20` (`plus-darker`) rim + `Gaussian(r=3, op=0.7)` shadow (`1px #000000`) |
| **Pressed Lens — Light** | `type: 4` | `0` (clear) | `1.00` | `0.075` | `0.00` | `0.40` | `1px #D9D9D9` (`plus-darker`) + `0.5px #FFFFFF@0.45` rim + `Gaussian(r=3, op=0.7)` shadow |
| **Track Brightness Shift** | — | — | `+0.08` tint | — | — | — | Filled track overlays `#FFFFFF@0.08` (Dark) / `#000000@0.08` (Light); Unfilled raises `0.10 -> 0.19` |

### 3.3 Complete Table of All `42` Shared Layer Styles

| Layer Style Name | Blur Type / Radius | Sat / Bri | Dist / Depth / CA | Fills & Blend Modes | Borders & Shadows |
|---|---|---|---|---|---|
| `Liquid Glass/Light/Regular - Small` | `t4 (Liquid Glass)` `r=6` | `2 / 1` | `0.4 / 0.8 / 0` | `#F8F8F8@0.20(luminosity) + #000000@0.25(normal) + #FFFFFF@0.25(normal) + #444444@0.60(plus-lighter)` | `B:0 S:13 IS:0` |
| `Liquid Glass/Dark/Regular - Small` | `t4 (Liquid Glass)` `r=6` | `1 / 1` | `0.4 / 0.8 / 0` | `#000000@1.00(screen) + #999999@0.17(normal)` | `B:0 S:12 IS:0` |
| `Materials/Light/3 Thin` | `t3 (Background)` `r=75` | `1.455 / 1` | `0.6 / 0.5 / 0` | `#FFFFFF@0.05(plus-lighter) + #FFFFFF@0.40(normal)` | `B:0 S:0 IS:0` |
| `Materials/Dark/1 Thick` | `t3 (Background)` `r=75` | `1 / 1` | `0.6 / 0.5 / 0` | `#000000@0.60(normal)` | `B:0 S:0 IS:0` |
| `Materials/Dark/3 Thin` | `t3 (Background)` `r=75` | `1 / 1` | `0.6 / 0.5 / 0` | `#000000@0.26(normal)` | `B:0 S:0 IS:0` |
| `Materials/Light/1 Thick` | `t3 (Background)` `r=75` | `1.001 / 1` | `0.6 / 0.5 / 0` | `#FFFFFF@0.34(plus-lighter) + #FFFFFF@0.84(normal)` | `B:0 S:0 IS:0` |
| `Materials/Light/4 Ultrathin` | `t3 (Background)` `r=45` | `1 / 1` | `0.6 / 0.5 / 0` | `#FFFFFF@0.07(plus-lighter) + #FFFFFF@0.03(normal)` | `B:0 S:0 IS:0` |
| `Materials/Light/2 Regular (Default)` | `t3 (Background)` `r=75` | `1.208 / 1` | `0.6 / 0.5 / 0` | `#FFFFFF@0.25(plus-lighter) + #FFFFFF@0.60(normal)` | `B:0 S:0 IS:0` |
| `Materials/Dark/2 Regular (Default)` | `t3 (Background)` `r=75` | `1 / 1` | `0.6 / 0.5 / 0` | `#000000@0.41(normal)` | `B:0 S:0 IS:0` |
| `Materials/Dark/4 Ultrathin` | `t3 (Background)` `r=75` | `1 / 1` | `0.6 / 0.5 / 0` | `#000000@0.00(normal)` | `B:0 S:0 IS:0` |
| `Liquid Glass/Light/Regular - Medium` | `t4 (Liquid Glass)` `r=15` | `1.4 / 1` | `0.3 / 0.9 / 0` | `#CCCCCC@0.70(lighten) + #BFBFBF@0.10(darken)` | `B:0 S:9 IS:0` |
| `Liquid Glass/Dark/Regular - Medium` | `t4 (Liquid Glass)` `r=30` | `1.2 / 1` | `0.3 / 0.9 / 0` | `#1A1A1A@0.30(normal) + #1A1A1A@0.30(luminosity) + #1A1A1A@1.00(lighten)` | `B:0 S:9 IS:0` |
| `Liquid Glass/Lock Screen Time` | `t4 (Liquid Glass)` `r=3` | `1.4 / 1` | `0.2 / 0.5 / 0` | `#F8F8F8@0.25(luminosity) + #1A1A1A@1.00(plus-lighter)` | `B:0 S:10 IS:0` |
| `Liquid Glass/Light/Dock` | `t4 (Liquid Glass)` `r=3` | `1 / 1` | `0.2 / 0.5 / 0` | `#999999@0.33(luminosity)` | `B:0 S:11 IS:0` |
| `Liquid Glass/Dark/Dock` | `t4 (Liquid Glass)` `r=3` | `1 / 1` | `0.2 / 0.5 / 0` | `#333333@0.33(luminosity)` | `B:0 S:11 IS:0` |
| `Liquid Glass/Dark/Regular - Large` | `t4 (Liquid Glass)` `r=30` | `1.2 / 1` | `0.3 / 0.9 / 0` | `#1A1A1A@0.50(normal) + #1A1A1A@0.90(luminosity) + #1A1A1A@1.00(lighten)` | `B:0 S:9 IS:0` |
| `Liquid Glass/Light/Regular - Large` | `t4 (Liquid Glass)` `r=30` | `1.4 / 1` | `0.3 / 0.9 / 0` | `#FFFFFF@0.70(lighten) + #BFBFBF@0.10(darken)` | `B:0 S:9 IS:0` |
| `Liquid Glass/Light/Regular - Small - Tinted` | `t4 (Liquid Glass)` `r=6` | `1 / 1` | `0.4 / 0.8 / 0` | `#FFFFFF@1.00(multiply)` | `B:0 S:11 IS:0` |
| `Liquid Glass/Dark/Regular - Small - Tinted` | `t4 (Liquid Glass)` `r=6` | `1 / 1` | `0.4 / 0.8 / 0` | `#000000@1.00(screen)` | `B:0 S:11 IS:0` |
| `Liquid Glass/Clear` | `t4 (Liquid Glass)` `r=3` | `1 / 1` | `0.2 / 0.5 / 0` | `#F8F8F8@0.12(luminosity)` | `B:0 S:13 IS:0` |
| `Controls/Light/Tracks/Active, Filled, 01 - Idle` | none | — | — | `#0088FF@1.00(normal)` | `B:0 S:0 IS:0` |
| `Controls/Light/Tracks/Active, Unfilled, 01 - Idle` | none | — | — | `#000000@0.10(normal)` | `B:0 S:0 IS:0` |
| `Controls/Light/Tracks/Active, Unfilled, 03 - Clicked` | none | — | — | `#000000@0.19(normal)` | `B:0 S:0 IS:0` |
| `Controls/Dark/Knobs - Toggle/03 - Clicked - Glow` | none | — | — | `none` | `B:1 S:0 IS:0` |
| `Controls/Dark/Tracks/Active, Unfilled, 03 - Clicked` | none | — | — | `#FFFFFF@0.19(normal)` | `B:0 S:0 IS:0` |
| `Controls/Light/Tracks/Active, Unfilled, 04 - Disabled` | none | — | — | `#000000@0.10(normal)` | `B:0 S:0 IS:0` |
| `Controls/Dark/Tracks/Active, Filled, 03 - Clicked` | none | — | — | `#0091FF@1.00(normal) + #FFFFFF@0.08(normal)` | `B:0 S:0 IS:0` |
| `Controls/Dark/Tracks/Active, Filled, 01 - Idle` | none | — | — | `#0091FF@1.00(normal)` | `B:0 S:0 IS:0` |
| `Controls/Dark/Knobs - Toggle/03 - Clicked - Shadow` | `t0 (Gaussian)` `r=3` | `1 / 1` | `0.5 / 0.5 / 0` | `none` | `B:1 S:0 IS:0` |
| `Controls/Dark/Tracks/Active, Unfilled, 01 - Idle` | none | — | — | `#FFFFFF@0.10(normal)` | `B:0 S:0 IS:0` |
| `Controls/Light/Tracks/Active, Filled, 03 - Clicked` | none | — | — | `#0088FF@1.00(normal) + #000000@0.08(normal)` | `B:0 S:0 IS:0` |
| `Controls/Dark/Tracks/Active, Unfilled, 04 - Disabled` | none | — | — | `#FFFFFF@0.10(normal)` | `B:0 S:0 IS:0` |
| `Controls/Light/Knobs - Toggle/03 - Clicked - Shadow` | `t0 (Gaussian)` `r=3` | `1 / 1` | `0.5 / 0.5 / 0` | `none` | `B:1 S:0 IS:0` |
| `Controls/Light/Knobs - Toggle/03 - Clicked - Glow` | none | — | — | `none` | `B:2 S:0 IS:0` |
| `Controls/Light/Knobs - Toggle/01 - Idle` | none | — | — | `#FFFFFF@1.00(normal)` | `B:0 S:1 IS:0` |
| `Liquid Glass/Light/Keyboard Background` | `t4 (Liquid Glass)` `r=4` | `1 / 1` | `0.3 / 0.8 / 0` | `#D4D4D4@0.74(luminosity) + #1B1B1B@1.00(plus-lighter) + #E6E9ED@1.00(plus-darker)` | `B:0 S:4 IS:0` |
| `Liquid Glass/Dark/Keyboard Background` | `t4 (Liquid Glass)` `r=8` | `1 / 1` | `0.4 / 0.8 / 0` | `#000000@0.25(normal) + #CCCCCC@1.00(plus-darker) + #0D0D0D@1.00(plus-lighter) + #262626@0.90(luminosity)` | `B:0 S:5 IS:0` |
| `Liquid Glass/Dark/App Library` | `t4 (Liquid Glass)` `r=5` | `1.3 / 1` | `0.2 / 0.5 / 0` | `#F8F8F8@0.05(screen)` | `B:0 S:7 IS:0` |
| `Liquid Glass/Light/App Library` | `t4 (Liquid Glass)` `r=5` | `1.3 / 1` | `0.2 / 0.5 / 0` | `#F8F8F8@0.08(luminosity)` | `B:0 S:7 IS:0` |
| `Liquid Glass/Widget Glass` | `t4 (Liquid Glass)` `r=3` | `1 / 1` | `0.2 / 0.5 / 0` | `gradient@1.00(plus-lighter)` | `B:0 S:6 IS:0` |
| `Liquid Glass/Light/Regular - Small - Inactive` | none | — | — | `#000000@0.02(normal)` | `B:0 S:1 IS:0` |
| `Liquid Glass/Dark/Regular - Small - Inactive` | none | — | — | `#767680@0.24(normal)` | `B:0 S:1 IS:0` |

### 3.4 CSS Implementation Mapping (Web / PWA)
Because standard browser CSS `backdrop-filter` does not expose `distortion` directly without WebGL or SVG filters (and SVG `<feImage>` fails on `backdrop-filter` in Chrome/Safari), iOS 27 Liquid Glass translates reliably to web CSS via:
1. **Surfaces (`Regular - Small` / `Dock`)**: `backdrop-filter: blur(5px) saturate(185%) brightness(1.06)` (Dark) / `saturate(200%)` (Light) + `rgba(38,38,42,0.56)` / `rgba(255,255,255,0.62)`.
2. **Fresnel Specular Rim Dispersion**: `1px` gradient border mask (`::before`) transitioning crisp top-left `#FFFFFF` specular highlight through cyan (`#3CD3FE@0.22`) / indigo (`#6D7CFF@0.20`) chromatic rim falloff.
3. **Pressed Interactive Lens**: `backdrop-filter: blur(0.5px) saturate(210%) brightness(1.20)` (Dark) / `brightness(1.04)` (Light) with inset `+1.5px` white specular crown, `-1px` base shadow, and subtle outer chromatic edge.

---

## 4. Color System & Semantic Tokens (`107` Swatches, `402` W3C Tokens)

### 4.1 System Colors (`12` Chromatic Accent Tokens)

| Token | Light Hex | Dark Hex | Light RGB | Dark RGB |
|---|---|---|---|---|
| **1 Red** | `#FF383C` | `#FF4245` | `255, 56, 60` | `255, 66, 69` |
| **2 Orange** | `#FF8D28` | `#FF9230` | `255, 141, 40` | `255, 146, 48` |
| **3 Yellow** | `#FFCC00` | `#FFD600` | `255, 204, 0` | `255, 214, 0` |
| **4 Green** | `#34C759` | `#30D158` | `52, 199, 89` | `48, 209, 88` |
| **5 Mint** | `#00C8B3` | `#00DAC3` | `0, 200, 179` | `0, 218, 195` |
| **6 Teal** | `#00C3D0` | `#00D2E0` | `0, 195, 208` | `0, 210, 224` |
| **7 Cyan** | `#00C0E8` | `#3CD3FE` | `0, 192, 232` | `60, 211, 254` |
| **8 Blue** | `#0088FF` | `#0091FF` | `0, 136, 255` | `0, 145, 255` |
| **9 Indigo** | `#6155F5` | `#6D7CFF` | `97, 85, 245` | `109, 124, 255` |
| **10 Purple** | `#CB30E0` | `#DB34F2` | `203, 48, 224` | `219, 52, 242` |
| **11 Pink** | `#FF2D55` | `#FF375F` | `255, 45, 85` | `255, 55, 95` |
| **12 Brown** | `#AC7F5E` | `#B78A66` | `172, 127, 94` | `183, 138, 102` |

### 4.2 Semantic Surfaces, Labels, Fills, Grays & Separators

| Category | Token Name | Light Value | Dark Base / Standard | Dark Elevated |
|---|---|---|---|---|
| Backgrounds | `Primary` | `#FFFFFF` | `#000000` | `#1C1C1E` |
| Backgrounds | `Secondary` | `#F2F2F7` | `#1C1C1E` | `#2C2C2E` |
| Backgrounds | `Tertiary` | `#FFFFFF` | `#2C2C2E` | `#3A3A3C` |
| Backgrounds Grouped | `Primary` | `#F2F2F7` | `#000000` | `#1C1C1E` |
| Backgrounds Grouped | `Secondary` | `#FFFFFF` | `#1C1C1E` | `#2C2C2E` |
| Backgrounds Grouped | `Tertiary` | `#F2F2F7` | `#2C2C2E` | `#3A3A3C` |
| Labels | `1 Primary` | `#000000` | `#FFFFFF` | `—` |
| Labels | `2 Secondary` | `rgba(60, 60, 67, 0.6)` | `rgba(235, 235, 245, 0.6)` | `—` |
| Labels | `3 Tertiary` | `rgba(60, 60, 67, 0.3)` | `rgba(235, 235, 245, 0.3)` | `—` |
| Labels | `4 Quaternary` | `rgba(60, 60, 67, 0.18)` | `rgba(235, 235, 245, 0.16)` | `—` |
| Labels | `5 Quinary` | `rgba(60, 60, 67, 0.09)` | `rgba(235, 235, 245, 0.09)` | `—` |
| Labels - Liquid Glass | `1 Primary` | `#1A1A1A` | `#EDEDED` | `—` |
| Labels - Liquid Glass | `2 Secondary` | `#727272` | `#8A8A8A` | `—` |
| Labels - Liquid Glass | `3 Tertiary` | `#BFBFBF` | `#404040` | `—` |
| Labels - Liquid Glass | `4 Quaternary` | `#D9D9D9` | `#262626` | `—` |
| Fills | `1 Primary` | `rgba(120, 120, 120, 0.2)` | `rgba(120, 120, 128, 0.36)` | `—` |
| Fills | `2 Secondary` | `rgba(120, 120, 128, 0.16)` | `rgba(120, 120, 128, 0.32)` | `—` |
| Fills | `3 Tertiary` | `rgba(118, 118, 128, 0.12)` | `rgba(118, 118, 128, 0.24)` | `—` |
| Fills | `4 Quaternary` | `rgba(116, 116, 128, 0.08)` | `rgba(118, 118, 128, 0.18)` | `—` |
| Fills | `5 Quinary` | `rgba(0, 0, 0, 0.02)` | `rgba(118, 118, 128, 0.02)` | `—` |
| Grays | `Gray` | `#8E8E93` | `#8E8E93` | `—` |
| Grays | `Gray 2` | `#AEAEB2` | `#636366` | `—` |
| Grays | `Gray 3` | `#C7C7CC` | `#48484A` | `—` |
| Grays | `Gray 4` | `#D1D1D6` | `#3A3A3C` | `—` |
| Grays | `Gray 5` | `#E5E5EA` | `#2C2C2E` | `—` |
| Grays | `Gray 6` | `#F2F2F7` | `#1C1C1E` | `—` |
| Separators | `Non-Opaque` | `rgba(0, 0, 0, 0.12)` | `rgba(255, 255, 255, 0.12)` | `—` |
| Separators | `Opaque` | `#C6C6C8` | `#38383A` | `—` |
| Separators | `Vibrant` | `#E6E6E6` | `#1A1A1A` | `—` |

### 4.3 Complete `107` Sketch Swatch Directory

<details><summary>Expand all 107 Sketch Color Swatches</summary>

| Swatch Name | Hex | RGBA |
|---|---|---|
| `System Colors/Light/8 Blue` | `#0088FF` | `rgba(0, 136, 255, 1)` |
| `System Colors/Light/4 Green` | `#34C759` | `rgba(52, 199, 89, 1)` |
| `Fills/Light/3 Tertiary` | `#767680` | `rgba(118, 118, 128, 0.12)` |
| `Labels/Light/3 Tertiary` | `#3C3C43` | `rgba(60, 60, 67, 0.3)` |
| `Labels/Dark/4 Quaternary` | `#EBEBF5` | `rgba(235, 235, 245, 0.16)` |
| `Labels/Light/2 Secondary` | `#3C3C43` | `rgba(60, 60, 67, 0.6)` |
| `Labels/Dark/3 Tertiary` | `#EBEBF5` | `rgba(235, 235, 245, 0.3)` |
| `Labels/Light/4 Quaternary` | `#3C3C43` | `rgba(60, 60, 67, 0.18)` |
| `Labels/Light/1 Primary` | `#000000` | `rgba(0, 0, 0, 1)` |
| `Labels/Dark/2 Secondary` | `#EBEBF5` | `rgba(235, 235, 245, 0.6)` |
| `Labels/Dark/1 Primary` | `#FFFFFF` | `rgba(255, 255, 255, 1)` |
| `Fills/Dark/1 Primary` | `#787880` | `rgba(120, 120, 128, 0.36)` |
| `Fills/Light/4 Quaternary` | `#747480` | `rgba(116, 116, 128, 0.08)` |
| `Fills/Dark/3 Tertiary` | `#767680` | `rgba(118, 118, 128, 0.24)` |
| `Fills/Light/2 Secondary` | `#787880` | `rgba(120, 120, 128, 0.16)` |
| `Fills/Light/1 Primary` | `#787878` | `rgba(120, 120, 120, 0.2)` |
| `Fills/Dark/2 Secondary` | `#787880` | `rgba(120, 120, 128, 0.32)` |
| `Fills/Dark/4 Quaternary` | `#767680` | `rgba(118, 118, 128, 0.18)` |
| `System Colors/Dark/6 Teal` | `#00D2E0` | `rgba(0, 210, 224, 1)` |
| `System Colors/Dark/8 Blue` | `#0091FF` | `rgba(0, 145, 255, 1)` |
| `System Colors/Dark/4 Green` | `#30D158` | `rgba(48, 209, 88, 1)` |
| `System Colors/Dark/1 Red` | `#FF4245` | `rgba(255, 66, 69, 1)` |
| `System Colors/Light/10 Purple` | `#CB30E0` | `rgba(203, 48, 224, 1)` |
| `System Colors/Dark/12 Brown` | `#B78A66` | `rgba(183, 138, 102, 1)` |
| `System Colors/Light/12 Brown` | `#AC7F5E` | `rgba(172, 127, 94, 1)` |
| `System Colors/Light/3 Yellow` | `#FFCC00` | `rgba(255, 204, 0, 1)` |
| `System Colors/Dark/11 Pink` | `#FF375F` | `rgba(255, 55, 95, 1)` |
| `System Colors/Light/6 Teal` | `#00C3D0` | `rgba(0, 195, 208, 1)` |
| `System Colors/Light/2 Orange` | `#FF8D28` | `rgba(255, 141, 40, 1)` |
| `System Colors/Light/5 Mint` | `#00C8B3` | `rgba(0, 200, 179, 1)` |
| `System Colors/Dark/10 Purple` | `#DB34F2` | `rgba(219, 52, 242, 1)` |
| `System Colors/Dark/9 Indigo` | `#6D7CFF` | `rgba(109, 124, 255, 1)` |
| `System Colors/Light/11 Pink` | `#FF2D55` | `rgba(255, 45, 85, 1)` |
| `System Colors/Dark/3 Yellow` | `#FFD600` | `rgba(255, 214, 0, 1)` |
| `System Colors/Dark/7 Cyan` | `#3CD3FE` | `rgba(60, 211, 254, 1)` |
| `System Colors/Dark/2 Orange` | `#FF9230` | `rgba(255, 146, 48, 1)` |
| `System Colors/Dark/5 Mint` | `#00DAC3` | `rgba(0, 218, 195, 1)` |
| `System Colors/Light/1 Red` | `#FF383C` | `rgba(255, 56, 60, 1)` |
| `System Colors/Light/7 Cyan` | `#00C0E8` | `rgba(0, 192, 232, 1)` |
| `System Colors/Light/9 Indigo` | `#6155F5` | `rgba(97, 85, 245, 1)` |
| `Grays/Dark/Gray 3` | `#48484A` | `rgba(72, 72, 74, 1)` |
| `Grays/Light/Gray` | `#8E8E93` | `rgba(142, 142, 147, 1)` |
| `Grays/Light/Gray 5` | `#E5E5EA` | `rgba(229, 229, 234, 1)` |
| `Grays/Dark/Gray 4` | `#3A3A3C` | `rgba(58, 58, 60, 1)` |
| `Grays/Light/Gray 3` | `#C7C7CC` | `rgba(199, 199, 204, 1)` |
| `Grays/Light/Gray 4` | `#D1D1D6` | `rgba(209, 209, 214, 1)` |
| `Grays/Dark/Gray 2` | `#636366` | `rgba(99, 99, 102, 1)` |
| `Grays/Light/Gray 6` | `#F2F2F7` | `rgba(242, 242, 247, 1)` |
| `Grays/Dark/Gray 5` | `#2C2C2E` | `rgba(44, 44, 46, 1)` |
| `Grays/Light/Gray 2` | `#AEAEB2` | `rgba(174, 174, 178, 1)` |
| `Grays/Dark/Gray 6` | `#1C1C1E` | `rgba(28, 28, 30, 1)` |
| `x. Kit/Nested Symbol BG Dark` | `#0059B3` | `rgba(0, 89, 179, 0.6)` |
| `x. Kit/Nested Symbol BG Light` | `#4DA6FF` | `rgba(77, 166, 255, 0.6)` |
| `x. Kit/Symbol BG Dark` | `#333333` | `rgba(51, 51, 51, 0.6)` |
| `x. Kit/Symbol BG Light` | `#CCCCCC` | `rgba(204, 204, 204, 0.6)` |
| `Backgrounds/Light/Primary` | `#FFFFFF` | `rgba(255, 255, 255, 1)` |
| `Backgrounds/Light/Tertiary` | `#FFFFFF` | `rgba(255, 255, 255, 1)` |
| `Backgrounds/Light/Secondary` | `#F2F2F7` | `rgba(242, 242, 247, 1)` |
| `Backgrounds/Dark - Elevated/Primary` | `#1C1C1E` | `rgba(28, 28, 30, 1)` |
| `Backgrounds/Dark - Base/Primary` | `#000000` | `rgba(0, 0, 0, 1)` |
| `Backgrounds/Dark - Elevated/Secondary` | `#2C2C2E` | `rgba(44, 44, 46, 1)` |
| `Backgrounds/Dark - Base/Secondary` | `#1C1C1E` | `rgba(28, 28, 30, 1)` |
| `Backgrounds/Dark - Elevated/Tertiary` | `#3A3A3C` | `rgba(58, 58, 60, 1)` |
| `Backgrounds/Dark - Base/Tertiary` | `#2C2C2E` | `rgba(44, 44, 46, 1)` |
| `Backgrounds Grouped/Dark - Base/Primary` | `#000000` | `rgba(0, 0, 0, 1)` |
| `Backgrounds Grouped/Dark - Base/Secondary` | `#1C1C1E` | `rgba(28, 28, 30, 1)` |
| `Backgrounds Grouped/Dark - Base/Tertiary` | `#2C2C2E` | `rgba(44, 44, 46, 1)` |
| `Backgrounds Grouped/Dark - Elevated/Primary` | `#1C1C1E` | `rgba(28, 28, 30, 1)` |
| `Backgrounds Grouped/Dark - Elevated/Secondary` | `#2C2C2E` | `rgba(44, 44, 46, 1)` |
| `Backgrounds Grouped/Dark - Elevated/Tertiary` | `#3A3A3C` | `rgba(58, 58, 60, 1)` |
| `Backgrounds Grouped/Light/Primary` | `#F2F2F7` | `rgba(242, 242, 247, 1)` |
| `Backgrounds Grouped/Light/Secondary` | `#FFFFFF` | `rgba(255, 255, 255, 1)` |
| `Backgrounds Grouped/Light/Tertiary` | `#F2F2F7` | `rgba(242, 242, 247, 1)` |
| `Grays/Dark/Gray` | `#8E8E93` | `rgba(142, 142, 147, 1)` |
| `Fills/Dark - Vibrant/1 Primary` | `#333333` | `rgba(51, 51, 51, 1)` |
| `Fills/Light - Vibrant/3 Tertiary` | `#EDEDED` | `rgba(237, 237, 237, 1)` |
| `Fills/Light - Vibrant/1 Primary` | `#CCCCCC` | `rgba(204, 204, 204, 1)` |
| `Fills/Light - Vibrant/2 Secondary` | `#E0E0E0` | `rgba(224, 224, 224, 1)` |
| `Fills/Dark - Vibrant/2 Secondary` | `#1F1F1F` | `rgba(31, 31, 31, 1)` |
| `Fills/Dark - Vibrant/3 Tertiary` | `#121212` | `rgba(18, 18, 18, 1)` |
| `Separators/Dark/Opaque` | `#38383A` | `rgba(56, 56, 58, 1)` |
| `Separators/Dark/Vibrant` | `#1A1A1A` | `rgba(26, 26, 26, 1)` |
| `Separators/Light/Vibrant` | `#E6E6E6` | `rgba(230, 230, 230, 1)` |
| `Separators/Light/Non-Opaque` | `#000000` | `rgba(0, 0, 0, 0.12)` |
| `Separators/Dark/Non-Opaque` | `#FFFFFF` | `rgba(255, 255, 255, 0.12)` |
| `Separators/Light/Opaque` | `#C6C6C8` | `rgba(198, 198, 200, 1)` |
| `Labels/Dark - Vibrant/2 Secondary` | `#999999` | `rgba(153, 153, 153, 1)` |
| `Labels/Light - Vibrant/1 Primary` | `#000000` | `rgba(0, 0, 0, 1)` |
| `Labels/Light - Vibrant/2 Secondary` | `#999999` | `rgba(153, 153, 153, 1)` |
| `Labels/Dark - Vibrant/4 Quaternary` | `#262626` | `rgba(38, 38, 38, 1)` |
| `Labels/Dark - Vibrant/3 Tertiary` | `#404040` | `rgba(64, 64, 64, 1)` |
| `Labels/Dark - Vibrant/1 Primary` | `#FFFFFF` | `rgba(255, 255, 255, 1)` |
| `Labels/Light - Vibrant/4 Quaternary` | `#D9D9D9` | `rgba(217, 217, 217, 1)` |
| `Labels/Light - Vibrant/3 Tertiary` | `#BFBFBF` | `rgba(191, 191, 191, 1)` |
| `x. Kit/Canvas Color` | `#BFBFBF` | `rgba(191, 191, 191, 1)` |
| `Labels - Liquid Glass/Light/1 Primary` | `#1A1A1A` | `rgba(26, 26, 26, 1)` |
| `Labels - Liquid Glass/Light/2 Secondary` | `#727272` | `rgba(114, 114, 114, 1)` |
| `Labels - Liquid Glass/Light/3 Tertiary` | `#BFBFBF` | `rgba(191, 191, 191, 1)` |
| `Labels - Liquid Glass/Light/4 Quaternary` | `#D9D9D9` | `rgba(217, 217, 217, 1)` |
| `Labels - Liquid Glass/Dark/1 Primary` | `#EDEDED` | `rgba(237, 237, 237, 1)` |
| `Labels - Liquid Glass/Dark/2 Secondary` | `#8A8A8A` | `rgba(138, 138, 138, 1)` |
| `Labels - Liquid Glass/Dark/3 Tertiary` | `#404040` | `rgba(64, 64, 64, 1)` |
| `Labels - Liquid Glass/Dark/4 Quaternary` | `#262626` | `rgba(38, 38, 38, 1)` |
| `Fills/Light/5 Quinary` | `#000000` | `rgba(0, 0, 0, 0.02)` |
| `Labels/Light/5 Quinary` | `#3C3C43` | `rgba(60, 60, 67, 0.09)` |
| `Labels/Dark/5 Quinary` | `#EBEBF5` | `rgba(235, 235, 245, 0.09)` |
| `Fills/Dark/5 Quinary` | `#767680` | `rgba(118, 118, 128, 0.02)` |

</details>

---

## 5. Typography & Dynamic Type (`105` Text Styles, `3` Leading Modes)

iOS 27.1.3 uses **SF Pro** (`SFPro-Regular`, `SFPro-Semibold`, `SFPro-Bold`, `SFPro-Medium`, italic faces) across `11` Dynamic Type levels. Every text style ships in **Default**, **Loose Leading (`+2pt` line height)**, and **Tight Leading (`-2pt` line height)** variants (`35 × 3 = 105` styles).

| Role | Size (pt) | Default Line Height (pt) | Tight Leading (pt) | Loose Leading (pt) | Weight Variants |
|---|---:|---:|---:|---:|---|
| **01 LargeTitle** | 34 | 41 | 39 | 43 | 2 Bold (`SFPro-Bold`), 1 Default (`SFPro-Regular`) |
| **02 Title1** | 28 | 34 | 32 | 36 | 1 Default (`SFPro-Regular`), 2 Bold (`SFPro-Bold`) |
| **03 Title2** | 22 | 28 | 26 | 30 | 2 Bold (`SFPro-Bold`), 1 Default (`SFPro-Regular`) |
| **04 Title3** | 20 | 25 | 23 | 27 | 1 Default (`SFPro-Regular`), 2 Bold (`SFPro-Semibold`) |
| **05 Headline** | 17 | 22 | 20 | 24 | 1 Default (`SFPro-Semibold`), 4 Bold Italic (`SFPro-SemiboldItalic`) |
| **06 Body** | 17 | 22 | 20 | 24 | 2 Bold (`SFPro-Semibold`), 1 Default (`SFPro-Regular`), 4 Bold Italic (`SFPro-SemiboldItalic`), 3 Italic (`SFPro-RegularItalic`), Default (`SFPro-Regular`) |
| **07 Callout** | 16 | 21 | 19 | 23 | 4 Bold Italic (`SFPro-SemiboldItalic`), 1 Default (`SFPro-Regular`), 2 Bold (`SFPro-Semibold`), 3 Italic (`SFPro-RegularItalic`) |
| **08 Subheadline** | 15 | 20 | 18 | 22 | 4 Bold Italic (`SFPro-SemiboldItalic`), 1 Default (`SFPro-Regular`), 2 Bold (`SFPro-Semibold`), 3 Italic (`SFPro-RegularItalic`) |
| **09 Footnote** | 13 | 18 | 16 | 20 | 1 Default (`SFPro-Regular`), 4 Bold Italic (`SFPro-SemiboldItalic`), 2 Bold (`SFPro-Semibold`), 3 Italic (`SFPro-RegularItalic`) |
| **10 Caption1** | 12 | 16 | 14 | 18 | 2 Bold (`SFPro-Medium`), 4 Bold Italic (`SFPro-MediumItalic`), 3 Italic (`SFPro-RegularItalic`), 1 Default (`SFPro-Regular`) |
| **11 Caption2** | 11 | 13 | 11 | 15 | 2 Bold (`SFPro-Semibold`), 3 Italic (`SFPro-RegularItalic`), 4 Bold Italic (`SFPro-SemiboldItalic`), 1 Default (`SFPro-Regular`) |

---

## 6. Complete Component & Page Specifications (All `36` Sketch Pages)

### 6.1 Full Page Index (`36` Pages)

| # | Page Name | Symbol Masters | Blur Layers | Primary Scope |
|---:|---|---:|---:|---|
| 1 | `Library Preview` | 0 | 4 | Design Documentation / Showcase |
| 2 | `— — — — — — — — — — —` | 0 | 0 | Design Documentation / Showcase |
| 3 | `􀝥 Colors` | 0 | 0 | Design Documentation / Showcase |
| 4 | `􁄻 Materials` | 0 | 24 | Design Documentation / Showcase |
| 5 | `􀅐 Text Styles and Dynamic Type` | 0 | 0 | Design Documentation / Showcase |
| 6 | `􀧐 Layout Guides` | 15 | 6 | `_Layout Overlays/Reserved Region`, `_Layout Overlays/Safe Area Inset`, `_Layout Overlays/Layout Margin` |
| 7 | `􁣳 Product Bezels` | 25 | 0 | `Bezels/iPhone 18 Pro/Silver - Portrait`, `Bezels/iPhone 18 Pro/Glacier - Portrait`, `Bezels/iPhone 18 Pro/Black - Portrait` |
| 8 | `— — — — — — — — — — —` | 0 | 0 | Design Documentation / Showcase |
| 9 | `􀟞 System` | 301 | 305 | `Wallpapers/Dark/iPad Pro M4 11`, `Wallpapers/Light/iPad Pro M4 11`, `Examples/Windows` |
| 10 | `— — — — — — — — — — —` | 0 | 0 | Design Documentation / Showcase |
| 11 | `􀈂 Activity Views` | 38 | 8 | `Activity View/􀻃/Dark/Buttons/Options`, `Activity View/􀻃/Light/Buttons/Options`, `Activity View/􀻃/Dark/Headers/Title + Subtitle + Drill-in Button` |
| 12 | `􀍡 Action Sheets` | 4 | 2 | `Action Sheets/Dark`, `Action Sheets/Light`, `Examples/Action Sheet/Light` |
| 13 | `􀇾 Alerts` | 18 | 8 | `Examples/Alert/Light`, `Examples/Alert/Dark`, `Alerts/􀻃/Dark/3 Destructive` |
| 14 | `􁸞 Buttons` | 264 | 48 | `Buttons/Dark/Large/Bordered/Symbol/4 - Disabled`, `Buttons/Dark/Large/Bordered/Symbol/1 - Idle`, `Buttons/Dark/Large/Bordered/Text/4 - Disabled` |
| 15 | `􀎘 Color Pickers` | 9 | 2 | `Color Pickers/􀻃/Color Grid`, `Color Pickers/􀻃/Dark/Swatches`, `Color Pickers/􀻃/Dark/Opacity Meter` |
| 16 | `􀉉 Date and Time Pickers` | 50 | 6 | `Examples/Date and Time Picker/Light`, `Examples/Date and Time Picker/Dark`, `Date and Time Pickers/Wheel/Dark/Time Picker` |
| 17 | `􀓔 Empty States` | 6 | 0 | `Examples/Empty State/Light/Large Symbol`, `Examples/Empty State/Light/Symbol in Circle`, `Examples/Empty State/Light/Title and Subtitle` |
| 18 | `􀎽 FaceID` | 2 | 0 | `FaceID/Authenticating`, `FaceID/Success` |
| 19 | `􀇳 Keyboards` | 384 | 34 | `Keyboard/Dark/iPad/Lower Case`, `Keyboard/Dark/iPad/Upper Case`, `Keyboard/Dark/􀻃/iPad/Keys/Command-Right` |
| 20 | `􀌇 Lists` | 117 | 0 | `Examples/Lists/Dark/Grouped`, `Lists/Dark/Grouped Table View`, `Lists/Dark/Footer/Footer` |
| 21 | `􀆏 Menus` | 108 | 8 | `Edit Menu/Dark/􀻃/Selection`, `Edit Menu/Dark/Text Selection`, `Edit Menu/Dark/􀻃/Menu Indicator` |
| 22 | `􀍠 Page Controls` | 44 | 18 | `Page Control/Dark/Background/8+ Dots, Last Selected`, `Page Control/􀻃/Dots - Dark/4pt`, `Page Control/􀻃/Dots - Dark/6pt` |
| 23 | `􀌸 Popovers` | 26 | 48 | `Popovers (iPad Only)/Dark/Bottom Trailing`, `Popovers (iPad Only)/Dark/Bottom Middle`, `Popovers (iPad Only)/Dark/Bottom Leading` |
| 24 | `􀴽 Progress Indicators` | 10 | 0 | `Progress Indicators/Dark/Table View Row`, `Progress Indicators/Dark/Indeterminate Spinner - Large`, `Progress Indicators/Dark/Indeterminate Spinner - Regular` |
| 25 | `􀿴 Segmented Controls` | 16 | 4 | `Segmented Controls/􀻃/Dark/1 - Unselected`, `Segmented Controls/􀻃/Dark/5 - Selected`, `Segmented Controls/􀻃/Light/1 - Unselected` |
| 26 | `􀽺 Sheets` | 50 | 28 | `Sheets/Dark/iPad`, `Examples/Sheet/Dark/iPhone Duo/Landscape/Inner - Folded/Small Detent`, `Examples/Sheet/Dark/iPhone Duo/Landscape/Inner - Folded/Medium Detent` |
| 27 | `􀏚 Sidebars` | 54 | 0 | `Sidebar/􀻃/Dark/Items/Trailing/Toggle`, `Sidebar/􀻃/Dark/Items/Trailing/Symbol`, `Sidebar/􀻃/Dark/Items/Trailing/Info` |
| 28 | `􀌆 Sliders` | 30 | 4 | `Sliders/􀻃/Knob/Dark/3 - Pressed`, `Sliders/􀻃/Knob/Dark/1 - Idle`, `Sliders/􀻃/Knob/Light/3 - Pressed` |
| 29 | `􂻥 Steppers` | 14 | 0 | `Stepper/Light/􀻃/Decrement/4 - Disabled`, `Stepper/Light/􀻃/Increment/4 - Disabled`, `Stepper/Light/􀻃/Decrement/3 - Pressed` |
| 30 | `􁝮 Tab Bars` | 84 | 54 | `Tab Bars/􀻃/Light/iPhone/Tab - Search`, `Tab Bars/􀻃/Light/iPhone/Tab - Default/Default`, `Tab Bars/􀻃/Light/iPhone/Tab - Default/Selected` |
| 31 | `􀅫 Text Fields` | 11 | 0 | `Text Fields/􀻃/Cursor`, `Text Fields/Light/Typing`, `Text Fields/Light/Default` |
| 32 | `􀜊 Toggles` | 14 | 4 | `Toggles/􀻃/Dark/Knob`, `Toggles/􀻃/Light/Knob`, `Toggles/Dark/Off/4 - Disabled` |
| 33 | `􀤋 Toolbars` | 216 | 57 | `Examples/Toolbar/Dark/iPhone/Bottom - Search`, `Examples/Toolbar/Dark/iPhone/Bottom - Controls`, `Examples/Toolbar/Light/iPhone/Bottom - Search` |
| 34 | `— — — — — — — — — — —` | 0 | 0 | Design Documentation / Showcase |
| 35 | `􀐫 Change Log` | 0 | 0 | Design Documentation / Showcase |
| 36 | `Kit` | 9 | 0 | `􀻃/Kit/Swatch Background`, `􀻃/Kit/Swatch Background`, `􀻃/Messages Transcript/Regular Width` |

### 6.2 Core Interactive Component Geometry & State Specs

#### Buttons (`P14 Buttons`, `264` symbols)
- **Variants:** `Borderless`, `Bordered`, `Bordered Prominent`, `Glass`, `Glass Prominent` + `Destructive` & `Disabled` across `Dark` and `Light`.
- **Sizes:** **Small** `28pt` tall (`SF Pro 15pt`), **Medium / Regular** `34pt` tall (`SF Pro 17pt`), **Large** `50pt` (`Bordered`/`Borderless`) or `46pt` (`Glass`/`Glass Prominent`), all continuous capsules (`r = inf`).
- **Glass Button Construction:** Stacked `Regular - Small` (`blur r=6, dist=0.4, depth=0.8`); **`Glass Prominent`** stacks `Tint Color` (`#FFFFFF@0.96` + System Accent `#0088FF`/`#0091FF` with `plus-lighter`/`multiply`) over `Tinted Glass` (`blur r=6`, `screen` Dark / `multiply` Light).
- **Disabled States:** `opacity: 0.5` in Light; explicit Dark disabled surface tokens (`Bordered`: `#EBEBF5@0.16`, `Destructive`: `#767680@0.18`).

#### Alerts (`P13 Alerts`, `18` symbols) & Action Sheets (`P12 Action Sheets`, `4` symbols)
- **Alerts:** `300pt` width, `r = 34px` continuous squircle, `blur(type: 4, r: 30)`, `48pt` tall pill buttons (`Primary` `#0091FF`/`#0088FF`, `Secondary` `#767680@0.24`/`0.12`, `Destructive` `#FF4245`/`#FF383C`). Supports 0/1/2 input fields and side-by-side or stacked buttons. Backdrop dim overlay: `#121212@0.56` (Dark) / `#29293A@0.23` (Light).
- **Action Sheets:** `260pt` popover/sheet container, `r = 34px`, `48pt` pill action buttons, `r = 20px` header icon/thumbnail lockups.

#### Toggles (`P32 Toggles`, `14` symbols)
- **Track:** `64 × 28pt` capsule (`r = 100`). Off: `#EBEBF5@0.30` (Dark) / `#3C3C43@0.30` (Light); On: System Green `#30D158` (Dark) / `#34C759` (Light); Disabled: `opacity: 0.5`.
- **Idle Knob:** `38 × 24pt` (`r = 13`), crisp white `#FFFFFF` with `blur(type: 0)` soft drop shadow (`y=3, b=36, a=0.05`).
- **Pressed/Dragged Lens:** Expands to **`59 × 37pt`** / **`58 × 38pt`** transparent optical lens (`r = 0, bri = 1.2 Dark / 1.0 Light, dist = 0.08/0.075, ca = 0.4/0`).
- **Accessibility `1 / 0` Labels:** `1 × 10pt` vertical bar inside On state (`White 1.0`), `10 × 10pt` oval outline inside Off state (`White 0.6` Dark / `White 1.0` Light).

#### Segmented Controls (`P25 Segmented Controls`, `16` symbols)
- **Track:** `370 × 48pt` (Large) / `370 × 32pt` (Small), `r = 100`, fill `#767680@0.24` (Dark) / `#767680@0.12` (Light); Disabled `opacity: 0.5`.
- **Selected Pill:** `#FFFFFF@0.27` (Dark) / `#FFFFFF` (Light); when touched/dragged transforms into **`59 × 37pt`** optical glass lens droplet.

#### Sliders (`P28 Sliders`, `30` symbols) & Steppers (`P29 Steppers`, `14` symbols)
- **Sliders:** `402 × 52pt` container, `370 × 6pt` track (`r = 3`), optional `4 × 4pt` oval **Ticks**, idle knob `37 × 24pt` -> pressed **`57 × 38pt`** optical lens (`r = 0, dist = 0.08, ca = 0.4` Dark), disabled `opacity: 0.5`.
- **Steppers:** `92 × 32pt` capsule pill with `1 × 24pt` central vertical divider (`#000@0.12` / `#FFF@0.12`), continuous highlight state on active half.

#### Progress Indicators (`P24`, `10` symbols) & Page Controls (`P22`, `44` symbols)
- **Activity Spinners:** `35px` (Large), `20px` (Medium), `14px` (Small) 8-blade radial spinners.
- **Determinate Progress Bar:** **`4pt`** capsule height (`27.1.3` update).
- **Page Controls:** `24pt` tall **Ultrathin** glass capsule pill containing `8×8` / `6×6` / `4×4` tapered page dots.

#### Tab Bars (`P30`, `84` symbols), Toolbars (`P33`, `216` symbols), Sidebars (`P27`, `54` symbols), Lists (`P20`, `117` symbols)
- **Tab Bars:** iPhone `360 × 62pt` floating glass capsule + detached `62 × 62pt` Search Orb (shrinks to `48 × 48pt` when focused); iPad `510 × 44pt` pill; draggable optical touch lens across items.
- **Toolbars:** iPhone Top `54 / 105 / 125pt`; Sheet Top `70 / 121 / 141pt`; Bottom Controls `402 × 56pt` (`48pt` capsule row, `34pt` / `44pt` icon pills); Top-right/inline search capsules.
- **Lists:** Grouped `370pt` cards (`r = 26pt`), `52pt` standard rows, `68pt` large rows with inset separators.
- **Sheets (`P26`, `50` symbols), Menus (`P21`, `108` symbols), Popovers (`P23`, `26` symbols), Text Fields (`P31`, `11` symbols):**
  - Sheets: Grabber **`60 × 4pt`** (`r = 2pt`), iPhone Medium `386 × 451pt` (`r = 34pt`), iPhone Large `402 × 812pt` (`top r = 38pt`), iPad Modal `936 × 770pt` (`r = 32pt`).
  - Menus: `r = 32pt`, iPad width `238pt`, `38pt` rows, `50pt` top quick-actions, Edit Menu pill `504 × 44pt`.
  - Popovers: `r = 13pt`, `Regular` (`r = 75`) material blur + `56 × 13pt` cartouche pointer arrow.
  - Text Fields: `288 × 52pt` container, `4 × 22pt` tint caret cursor.
- **Keyboards (`P19`, `384` symbols), Pickers (`P15–P16`), Empty States (`P17`), FaceID (`P18`), Activity Views (`P11`):**
  - Keyboards: iPad `1210 × 428`, iPhone NumPad `402 × 308`, Emoji `402 × 393`, iPhone Duo layouts.
  - Color Pickers: `354 / 370px` spectrum/grid (`30 × 30` swatches); Date Pickers: `38 × 38` day grid, `297 × 215` wheel, `100 × 36` AM/PM; FaceID: `143 × 145` (`r = 40`).
- **System Windows, Status Bars, Control Center, Lock Screen & Widgets (`P9 System`, `301` symbols):**
  - iPad Window Controls (`41 × 22pt` pill with `6×6` traffic dots, `32 × 32pt` corner resize grabbers), Control Center glass tiles (`68×68` / `155×69` / `155×155` iPhone; `66×66` / `142×66` / `142×142` iPad), Widgets (`164×185`..`349×586` iPhone; `136×136`..`628×300` iPad), Lock Screen Time (`Lock Screen Time` glass shader), Home Screen Docks (`368×103` iPhone / `740×107` iPad).

---

## 7. `siri-sphere` ("Aurora Orb") WebGL Shader Reference

The companion `siri-sphere.zip` asset implements a standalone interactive `"Aurora Orb"` (`React 19.2.6` + `Three.js 0.187.0`) in `src/components/OrbScene.tsx`:
- **Outer Liquid Glass Fresnel Shell (`SphereGeometry(1.0, 64, 64)`):** Custom GLSL fragment shader using `pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.35)` Fresnel rim luminance cycling smoothly across an iridescent 6-stop pastel palette (`#62D4FF` cyan → `#A774FF` violet → `#FF7AD0` magenta → `#FFD488` amber → `#65F5DC` mint → `#62D4FF`), with edge-weighted opacity (`0.06` center to `0.24` rim).
- **Internal Aurora Ribbons:** `11` procedural twisted double-sided ribbon meshes (`Tube`/`CatmullRomCurve3`, `128` radial segments, additive plasma blending) undulating continuously inside the refractive shell.
- **Atmosphere & Interaction:** Layered soft glow sprites + pointer tilt/drag inertia, click shockwave pulse, ambient breathing scale curve, and optional **Web Audio API FFT** microphone audio reactivity.
