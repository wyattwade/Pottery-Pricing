import { describe, it, expect } from 'vitest';
import { calculatePrice, PricingData } from './pricing';

const mockPricingData: PricingData = {
  pricingMatrix: [
    { id: 1, minCost: 0, maxCost: 5, multiplier: 4, userId: 1 },
    { id: 2, minCost: 5.01, maxCost: 10, multiplier: 3.5, userId: 1 },
    { id: 3, minCost: 10.01, maxCost: 20, multiplier: 3, userId: 1 },
  ],
  rules: [
    { id: 1, name: 'addedMultiplier', value: 6, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 },
    { id: 2, name: 'roundToDollar', value: 1.0, type: 'ROUND_NEAREST', isActive: true, userId: 1 },
    { id: 3, name: 'roundMultiple10Minus1', value: 1, type: 'ADJUST_MULTIPLE_10', isActive: true, userId: 1 },
    { id: 4, name: 'mugMinPrice', value: 20, type: 'MIN_FIXED_MUG', isActive: true, userId: 1 },
    { id: 5, name: 'platePricePerInch', value: 3.0, type: 'FACTOR_SIZE', isActive: true, userId: 1 },
    { id: 6, name: 'plateCostWeight', value: 0.65, type: 'WEIGHT_COST', isActive: true, userId: 1 },
    { id: 7, name: 'plateSizeWeight', value: 0.35, type: 'WEIGHT_SIZE', isActive: true, userId: 1 },
    { id: 8, name: 'plateMinPrice', value: 20, type: 'MIN_FIXED_PLATE', isActive: true, userId: 1 },

    { id: 10, name: 'smallFigurineMinPrice', value: 22, type: 'MIN_FIXED_FIG', isActive: true, userId: 1 },
    { id: 11, name: 'maxMarkupAmount', value: 90, type: 'MAX_MARKUP_CAP', isActive: true, userId: 1 },
  ],
  products: []
};

describe('pricing logic', () => {
  it('calculates standard price correctly', () => {
    // Cost $4, Multiplier 4 -> $16
    // Added 6% -> 16 * 1.06 = 16.96
    // Round to nearest dollar -> $17
    const result = calculatePrice(4, mockPricingData);
    expect(result.finalPrice).toBe(17);
  });

  it('applies mug minimum price', () => {
    // Cost $2, Multiplier 4 -> $8
    // Added 6% -> 8.48
    // Round -> $8
    // Mug minimum -> $20
    const result = calculatePrice(2, mockPricingData, { itemType: 'cups/mugs' });
    expect(result.finalPrice).toBe(20);
  });

  it('applies plate formula correctly', () => {
    // Cost $10, Size 10
    // Range: Multiplier 3.5
    // Std Price = 10 * 3.5 = 35. 
    // Added 6% = 35 * 1.06 = 37.1
    // Size Component = 10 * 3 = 30
    // Weighted Formula = (37.1 * 0.65) + (30 * 0.35) = 24.115 + 10.5 = 34.615
    // Round to dollar -> $35
    const result = calculatePrice(10, mockPricingData, { itemType: 'plate', size: 10 });
    expect(result.finalPrice).toBe(35);
  });

  it('applies plate minimum price', () => {
    // Cost $2, Size 4
    // Std Price = 2 * 4 = 8. Added 4% = 8.32
    // Size Component = 4 * 3 = 12
    // Weighted = (8.32 * 0.65) + (12 * 0.35) = 5.408 + 4.2 = 9.608
    // Round to dollar -> $10
    // Plate minimum -> $20
    const result = calculatePrice(2, mockPricingData, { itemType: 'plate', size: 4 });
    expect(result.finalPrice).toBe(20);
  });

  it('applies figurine adjustment', () => {
    // Cost $15, Multiplier 3 -> $45
    // Added 4% -> 46.8
    // Round to dollar -> $47
    // Figurine discount removed -> $47
    // Min $22 -> $47
    const result = calculatePrice(15, mockPricingData, { itemType: 'small-figurines' });
    expect(result.finalPrice).toBe(48);
  });

  it('rounds to the nearest dollar, with no "minus one" adjustment', () => {
    // Cost $2.404, Multiplier 4 -> $9.616
    // Added 6% -> 10.19
    // Round to nearest dollar -> $10 (multiples of 10 are allowed)
    const result = calculatePrice(2.404, mockPricingData);
    expect(result.finalPrice).toBe(10);
  });

  it('applies max markup cap', () => {
    // Cost $5, Multiplier 4 -> $20
    // Added 4% -> 20.8
    // Round to dollar -> $21
    // Markup = 21 - 5 = 16. Cap is 90, so no change.

    // Let's test with a huge multiplier
    const dataWithHugeMult: PricingData = {
        ...mockPricingData,
        pricingMatrix: [{ id: 1, minCost: 0, maxCost: 1000, multiplier: 100, userId: 1 }]
    };
    // Cost $10 -> $1000
    // Added 4% -> $1040
    // Round -> $1040
    // Max Markup 90 -> 10 + 90 = 100
    const result = calculatePrice(10, dataWithHugeMult);
    expect(result.finalPrice).toBe(100);
  });

  it('falls back to max tier for high costs (and applies max markup cap)', () => {
    // Cost $50, Max tier is $20 (mult 3)
    // 50 * 3 = 150
    // Added 4% = 156
    // Round -> $156
    // BUT Max Markup Cap is 90 -> 50 + 90 = 140
    const result = calculatePrice(50, mockPricingData);
    expect(result.finalPrice).toBe(140);
  });

  it('never prices an item below the top of the tier beneath it', () => {
    // $5.00 -> 5 * 4 = 20. $5.01 -> 5.01 * 3.5 = 17.54, which would undercut it.
    // Never-drop rule holds $5.01 at the $20 base of a $5.00 item.
    const atEdge = calculatePrice(5.00, mockPricingData);
    const justOver = calculatePrice(5.01, mockPricingData);
    expect(justOver.finalPrice).toBe(atEdge.finalPrice);
    expect(justOver.appliedRules.some(r => r.name === 'Tier Floor')).toBe(true);
    expect(atEdge.appliedRules.some(r => r.name === 'Tier Floor')).toBe(false);
  });

  it('price never drops as cost rises, for any item type', () => {
    const types = [
      {},
      { itemType: 'cups/mugs', width: 3.5, height: 4 },
      { itemType: 'plate', size: 10 },
      { itemType: 'bowl', width: 6, height: 3 },
    ];
    for (const attrs of types) {
      let prev = 0;
      for (let cents = 1; cents <= 2000; cents++) {
        const price = calculatePrice(cents / 100, mockPricingData, attrs).finalPrice;
        expect(price, `${JSON.stringify(attrs)} at $${(cents / 100).toFixed(2)}`).toBeGreaterThanOrEqual(prev);
        prev = price;
      }
    }
  });

  it('skips blocked prices, moving to the closer allowed neighbour', () => {
    // $8.95 × 3.5 + 6% = $33.20 -> $33 is blocked; $34 is closer than $32
    expect(calculatePrice(8.95, mockPricingData).finalPrice).toBe(34);
    // $8.79 × 3.5 + 6% = $32.61 -> $33 is blocked; $32 is closer than $34
    expect(calculatePrice(8.79, mockPricingData).finalPrice).toBe(32);
  });

  it('never lands on a blocked price', () => {
    const blocked = [33, 43, 53, 66, 83, 93];
    for (const attrs of [{}, { itemType: 'plate', size: 14 }, { itemType: 'bowl', width: 10, height: 4 }]) {
      for (let cents = 1; cents <= 3000; cents++) {
        const price = calculatePrice(cents / 100, mockPricingData, attrs).finalPrice;
        expect(blocked, `${JSON.stringify(attrs)} at $${(cents / 100).toFixed(2)}`).not.toContain(price);
      }
    }
  });
});
