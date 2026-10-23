import { describe, expect, it } from 'vitest';
import {
  computePopcornBatchMetrics,
  DEFAULT_POPCORN_RECIPE,
  DEFAULT_UNIFIED_CATALOG,
} from '../apps/mobile/lib/pos-data';

describe('Popcorn Batch Economics & Catalog Pricing', () => {
  it('correctly models 1-gallon batch with 500 plastic bags, spices K20, salt K5, K2/bag', () => {
    const metrics = computePopcornBatchMetrics(1, DEFAULT_POPCORN_RECIPE);

    expect(metrics.gallons).toBe(1);
    expect(metrics.expectedBags).toBe(500);
    expect(metrics.spicesCost).toBe(20);
    expect(metrics.saltCost).toBe(5);
    // 500 bags at K2.00 = K1,000.00
    expect(metrics.expectedRevenue).toBe(1000);
    // Revenue > Total Cost
    expect(metrics.expectedProfit).toBeGreaterThan(0);
    expect(metrics.costPerBag).toBeLessThan(2.0);
  });

  it('verifies updated catalog prices match customer specifications', () => {
    // Popcorn selling price K2
    const saltedPopcorn = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'prod-snack-popcorn-salted',
    );
    expect(saltedPopcorn?.price).toBe(2.0);

    // Photocopying B/W Single is K2
    const photocopyBw = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-photocopy-bw-single',
    );
    expect(photocopyBw?.price).toBe(2.0);

    // Photocopy IDs is K3
    const photocopyId = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-photocopy-id',
    );
    expect(photocopyId?.price).toBe(3.0);

    // Printing B/W is K5
    const printBw = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-printing-bw',
    );
    expect(printBw?.price).toBe(5.0);

    // Printing Color is K10
    const printColor = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-printing-color',
    );
    expect(printColor?.price).toBe(10.0);

    // Wall Stickers is K35
    const stickers = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-printing-wall-stickers',
    );
    expect(stickers?.price).toBe(35.0);

    // Cake Toppers is K35
    const toppers = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-printing-cake-toppers',
    );
    expect(toppers?.price).toBe(35.0);

    // Certificates is K20
    const certs = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-printing-certificates',
    );
    expect(certs?.price).toBe(20.0);

    // Barbing Adult K25, Children K15, Shaving K10
    const barbingAdult = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-barbing-adult',
    );
    expect(barbingAdult?.price).toBe(25.0);

    const barbingKids = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-barbing-children',
    );
    expect(barbingKids?.price).toBe(15.0);

    const shaving = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-shaving',
    );
    expect(shaving?.price).toBe(10.0);

    // T-PIN K50, NAPSA K50, ECZ K25
    const tpin = DEFAULT_UNIFIED_CATALOG.find((c) => c.id === 'srv-tpin-reg');
    expect(tpin?.price).toBe(50.0);

    const napsa = DEFAULT_UNIFIED_CATALOG.find((c) => c.id === 'srv-napsa-reg');
    expect(napsa?.price).toBe(50.0);

    const ecz = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-ecz-statement',
    );
    expect(ecz?.price).toBe(25.0);

    // Laminating K20, Binding K25
    const lam = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-laminating-a4',
    );
    expect(lam?.price).toBe(20.0);

    const bind = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-binding-spiral',
    );
    expect(bind?.price).toBe(25.0);

    // Phone charging K10 smartphone, K5 small phone
    const chargeSmart = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-phone-charge-smart',
    );
    expect(chargeSmart?.price).toBe(10.0);

    const chargeSmall = DEFAULT_UNIFIED_CATALOG.find(
      (c) => c.id === 'srv-phone-charge-small',
    );
    expect(chargeSmall?.price).toBe(5.0);
  });
});

