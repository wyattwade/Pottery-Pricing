import { describe, it, expect } from 'vitest';
import { calculatePrice, PricingData } from './pricing';

const mockPricingData: PricingData = {
  pricingMatrix: [
    { id: 1, minCost: 0, maxCost: 5, multiplier: 4, userId: 1 },
    { id: 2, minCost: 5.01, maxCost: 10, multiplier: 3.5, userId: 1 },
    { id: 3, minCost: 10.01, maxCost: 20, multiplier: 3, userId: 1 },
  ],
  rules: [
    { id: 1, name: 'addedMultiplier', value: 4, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 },
    { id: 2, name: 'roundToDollar', value: 1.0, type: 'ROUND_NEAREST', isActive: true, userId: 1 },
    { id: 3, name: 'roundMultiple10Minus1', value: 1, type: 'ADJUST_MULTIPLE_10', isActive: true, userId: 1 },
    { id: 4, name: 'mugMinPrice', value: 19, type: 'MIN_FIXED_MUG', isActive: true, userId: 1 },
    { id: 5, name: 'platePricePerInch', value: 3.0, type: 'FACTOR_SIZE', isActive: true, userId: 1 },
    { id: 6, name: 'plateCostWeight', value: 0.65, type: 'WEIGHT_COST', isActive: true, userId: 1 },
    { id: 7, name: 'plateSizeWeight', value: 0.35, type: 'WEIGHT_SIZE', isActive: true, userId: 1 },
    { id: 8, name: 'plateMinPrice', value: 20, type: 'MIN_FIXED_PLATE', isActive: true, userId: 1 },
    { id: 9, name: 'smallFigurineDiscount', value: 10, type: 'FIXED_DISCOUNT', isActive: true, userId: 1 },
    { id: 10, name: 'smallFigurineMinPrice', value: 22, type: 'MIN_FIXED_FIG', isActive: true, userId: 1 },
    { id: 11, name: 'maxMarkupAmount', value: 90, type: 'MAX_MARKUP_CAP', isActive: true, userId: 1 },
  ],
  products: []
};

describe('pricing logic', () => {
  it('calculates standard price correctly', () => {
    // Cost $4, Multiplier 4 -> $16
    // Added 4% -> 16 * 1.04 = 16.64
    // Round to dollar -> $17
    const result = calculatePrice(4, mockPricingData);
    expect(result.finalPrice).toBe(17);
  });

  it('applies mug minimum price', () => {
    // Cost $2, Multiplier 4 -> $8
    // Added 4% -> 8.32
    // Round to dollar -> $8
    // Mug minimum -> $19
    const result = calculatePrice(2, mockPricingData, { itemType: 'cups/mugs' });
    expect(result.finalPrice).toBe(19);
  });

  it('applies plate formula correctly', () => {
    // Cost $10, Size 10
    // Range: Multiplier 3.5
    // Std Price = 10 * 3.5 = 35. 
    // Added 4% = 35 * 1.04 = 36.4
    // Size Component = 10 * 3 = 30
    // Weighted Formula = (36.4 * 0.65) + (30 * 0.35) = 23.66 + 10.5 = 34.16
    // Round to dollar -> $34
    const result = calculatePrice(10, mockPricingData, { itemType: 'plate', size: 10 });
    expect(result.finalPrice).toBe(34);
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
    // Figurine discount $10 -> $37
    // Min $22 -> $37
    const result = calculatePrice(15, mockPricingData, { itemType: 'small-figurines' });
    expect(result.finalPrice).toBe(37);
  });

  it('applies "Minus One" rule for multiples of 10', () => {
    // Cost $2.404, Multiplier 4 -> $9.616
    // Added 4% -> 10.00064
    // Round to dollar -> $10
    // Minus one -> $9
    const result = calculatePrice(2.404, mockPricingData);
    expect(result.finalPrice).toBe(9);
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
});
