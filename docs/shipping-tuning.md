# Shipping Cost Tuning Guide

This guide explains how to tune the progressive and balanced shipping cost formulas used by the main server.

File location:

- Source: `old-main-server/src/services/LogisticsService.ts`
- Tuning constants are defined near the top of the file (after the type definitions).

## Progressive Shipping Model (Cart total)

Progressive shipping charges the first few units at full base price, then applies a sublinear, decaying rate per block of units. It also includes a cart-level saturation multiplier and a dynamic cap to prevent runaway totals for very large orders.

### Key constants to tune

- PROG_FIRST_INTERVAL (default 10)

  - Units billed at full base shipping before discounts start.
  - Lower to start discounts earlier; raise to charge full price for more initial units.

- PROG_INTERVAL_SIZE (default 50)

  - Size of each discounted block after the first interval.
  - Decrease to apply lower per-unit factors sooner (cheaper at scale).
  - Increase to slow down the discount progression (more expensive).

- PROG_FLOOR_RATIO (default 0.05)

  - Minimum per-unit fraction of base shipping as quantity gets very large (asymptotic floor).
  - Lower (e.g., 0.03–0.04) to make very large orders cheaper.
  - Higher (e.g., 0.06–0.08) to keep a stronger floor.

- PROG_DECAY_RATE (default 0.6)

  - How quickly the per-interval per-unit factor decays toward PROG_FLOOR_RATIO.
  - Increase (e.g., 0.8–1.2) for faster decay → cheaper at scale.
  - Decrease (e.g., 0.3–0.5) for slower decay → more expensive.

- PROG_SATURATION_FLOOR (default 0.35)

  - A floor on the cart-level multiplier applied after summing the line items.
  - Lower to reduce totals more for large carts; higher to be more conservative.

- PROG_SATURATION_LN_COEFF (default 0.25)

  - Controls how fast the saturation multiplier decreases with ln(total quantity).
  - Increase to reduce large-cart totals more aggressively.

- PROG_CAP_BASE, PROG_CAP_LN_COEFF, PROG_CAP_MULTIPLIER (defaults: 8, 5, 20)
  - Define a sublinear cap: `cap = fallbackPrice × (PROG_CAP_BASE + PROG_CAP_LN_COEFF × ln(qty+1)) × PROG_CAP_MULTIPLIER`.
  - Reduce these to clamp extreme cases more tightly (lower totals at very high quantities).

### Per-interval decay formula

For interval i ≥ 1, the per-unit factor is:

$$
\text{unitFactor}(i) = \text{FLOOR\_RATIO} + \frac{1 - \text{FLOOR\_RATIO}}{1 + \text{DECAY\_RATE} \cdot i}
$$

- The first `PROG_FIRST_INTERVAL` units are billed at full base shipping.
- After that, each block of `PROG_INTERVAL_SIZE` units uses the factor above.
- As i increases, the factor approaches `PROG_FLOOR_RATIO`.

### Practical tuning recipes

- Cheaper at scale (recommended starting point):

  - PROG_DECAY_RATE: 0.9–1.2
  - PROG_INTERVAL_SIZE: 25–40
  - PROG_FLOOR_RATIO: 0.03–0.04
  - PROG_SATURATION_FLOOR: 0.25–0.30
  - PROG_CAP_MULTIPLIER: 10–15, PROG_CAP_LN_COEFF: 3–4

- Balanced:

  - PROG_DECAY_RATE: 0.8
  - PROG_INTERVAL_SIZE: 40–50
  - PROG_FLOOR_RATIO: 0.05
  - PROG_SATURATION_FLOOR: 0.30–0.35
  - Keep cap defaults or slightly reduce (e.g., multiplier 15)

- Conservative (higher revenue):
  - PROG_DECAY_RATE: 0.4–0.6
  - PROG_INTERVAL_SIZE: 60–80
  - PROG_FLOOR_RATIO: 0.06–0.08
  - PROG_SATURATION_FLOOR: 0.40
  - Cap unchanged or increased

## Balanced Shipping Model

Balanced shipping applies dimensional and quantity adjustments on top of the computed line shipping.

- BAL_SURCHARGE_FACTOR (default 0.01)

  - Scales the impact of dimensions (weight/height/width) on shipping.
  - Increase to make bulky items more expensive; decrease to soften it.

- BAL_SURCHARGE_CAP (default 1.5)
  - Maximum multiplier for the dimensional surcharge.
  - Lower to prevent very heavy/large items from scaling too much.

## Where to edit

1. Open `old-main-server/src/services/LogisticsService.ts`.
2. Locate the constants block:

```ts
// Progressive shipping constants
const PROG_FIRST_INTERVAL = 10;
const PROG_INTERVAL_SIZE = 50;
const PROG_FLOOR_RATIO = 0.05;
const PROG_DECAY_RATE = 0.6;
const PROG_SATURATION_FLOOR = 0.35;
const PROG_SATURATION_LN_COEFF = 0.25;
const PROG_CAP_BASE = 8;
const PROG_CAP_LN_COEFF = 5;
const PROG_CAP_MULTIPLIER = 20;

// Balanced shipping constants
const BAL_SURCHARGE_FACTOR = 0.01;
const BAL_SURCHARGE_CAP = 1.5;
```

3. Adjust values as needed using the guidelines above.

## Tips

- Change one parameter at a time and test with sample carts: 10, 100, 1,000, 10,000 units.
- If regional `fallbackPrice` values are very high, totals will start higher; tune those in the logistics config for specific states/LGAs as needed.
- Keep a record of tuned profiles per region if pricing varies geographically.

## Troubleshooting

- Totals still look too high at very large quantities:
  - Lower PROG_FLOOR_RATIO, increase PROG_DECAY_RATE, reduce PROG_CAP_MULTIPLIER.
- Small orders got too cheap:
  - Increase PROG_FIRST_INTERVAL, increase PROG_INTERVAL_SIZE, reduce PROG_DECAY_RATE.
- Dimensional items dominate cost:
  - Reduce BAL_SURCHARGE_FACTOR and/or BAL_SURCHARGE_CAP.

If you share target price ranges for specific quantities (e.g., 100/1k/10k units per region), we can propose and commit a tuned set of constants.
