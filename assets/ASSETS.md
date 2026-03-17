# APEX Analytics — Asset System

## Folder Structure

```
assets/
├── apex.css          ← Design system
├── apex.js           ← Universal renderer
├── drivers/          ← Driver photos (replace SVG placeholders with JPGs)
├── teams/            ← Team identity SVGs
├── numbers/          ← Car number SVGs (team-coloured)
└── helmets/          ← Helmet designs (optional enhancement)
```

## Driver Photos

**Placeholder:** `assets/drivers/{driver-id}.svg`
**Replace with:** `assets/drivers/{driver-id}.jpg`

The renderer checks for `.jpg` first, falls back to `.svg`.
Standard size: **400×480px** (5:6 portrait ratio).
FIA official driver images are the preferred source — consistent framing, helmet on.

### Current drivers (2026)
| File | Driver |
|------|--------|
| russell-george.jpg | George Russell |
| antonelli-kimi.jpg | Kimi Antonelli |
| leclerc-charles.jpg | Charles Leclerc |
| hamilton-lewis.jpg | Lewis Hamilton |
| norris-lando.jpg | Lando Norris |
| piastri-oscar.jpg | Oscar Piastri |
| verstappen-max.jpg | Max Verstappen |
| hadjar-isack.jpg | Isack Hadjar |
| bearman-oliver.jpg | Oliver Bearman |
| gasly-pierre.jpg | Pierre Gasly |
| colapinto-franco.jpg | Franco Colapinto |
| lawson-liam.jpg | Liam Lawson |
| lindblad-arvid.jpg | Arvid Lindblad |
| sainz-carlos.jpg | Carlos Sainz |
| albon-alex.jpg | Alexander Albon |
| bortoleto-gabriel.jpg | Gabriel Bortoleto |
| hulkenberg-nico.jpg | Nico Hülkenberg |
| bottas-valtteri.jpg | Valtteri Bottas |
| alonso-fernando.jpg | Fernando Alonso |
| stroll-lance.jpg | Lance Stroll |

## Team Logos

SVG files — scale perfectly at any size.

| File | Team |
|------|------|
| mercedes.svg | Mercedes-AMG Petronas |
| ferrari.svg | Scuderia Ferrari |
| mclaren.svg | McLaren |
| red-bull.svg | Red Bull Racing |
| haas.svg | Haas F1 Team |
| alpine.svg | Alpine F1 Team |
| racing-bulls.svg | Visa Cash App Racing Bulls |
| williams.svg | Williams Racing |
| audi.svg | Audi Formula Racing |
| cadillac.svg | Cadillac F1 Team |
| aston-martin.svg | Aston Martin |

Replace generated SVGs with official team vector logos when available.

## Car Numbers

SVG files — driver's number in team colour with glow effect.
| Range | Note |
|-------|------|
| 1.svg–87.svg | Single number per driver |
| 23b.svg | Albon (23 also used by Hadjar) |

## Adding a New Series

1. Create `assets/drivers/{series}/` folder
2. Create `assets/teams/{series}/` folder  
3. Add driver IDs to `competitors-{series}-{year}.json`
4. Renderer auto-resolves paths from `series.id` + `competitor.id`
