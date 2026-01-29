import { describe, it, expect } from 'vitest';
import { calculatePrice, PricingData } from './pricing';

const mockPricingData: PricingData = {
  pricingMatrix: [
    { id: 1, minCost: 0, maxCost: 1.75, multiplier: 4, userId: 1 }, // Used for $3.50 -> 4x
    { id: 2, minCost: 5.01, maxCost: 10, multiplier: 3.5, userId: 1 },
    { id: 3, minCost: 10.01, maxCost: 11.75, multiplier: 3, userId: 1 },
    { id: 4, minCost: 1.76, maxCost: 5.00, multiplier: 7.75, userId: 1 }, // Used for $2.00 -> 7.75x
    { id: 5, minCost: 11.76, maxCost: 13.25, multiplier: 4, userId: 1 }, // Used for $12 -> 4x
  ],
  rules: [
    { id: 1, name: 'addedMultiplier', value: 6, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 },
    { id: 2, name: 'roundToDollar', value: 1.0, type: 'ROUND_NEAREST', isActive: true, userId: 1 },
    // Bowl Rules
    { id: 12, name: 'bowlPricePerInch', value: 3.2, type: 'FACTOR_SIZE_BOWL', isActive: true, userId: 1 },
    { id: 13, name: 'bowlWidthWeight', value: 1.0, type: 'WEIGHT_WIDTH', isActive: true, userId: 1 },
    { id: 14, name: 'bowlHeightWeight', value: 1.0, type: 'WEIGHT_HEIGHT', isActive: true, userId: 1 },
    { id: 15, name: 'bowlCostWeight', value: 0.60, type: 'WEIGHT_COST_BOWL', isActive: true, userId: 1 },
    { id: 16, name: 'bowlSizeWeight', value: 0.40, type: 'WEIGHT_SIZE_BOWL', isActive: true, userId: 1 },
  ],
  products: []
};

describe('Bowl Pricing Logic', () => {
  it('calculates price effectively for a cheap large bowl', () => {
      // Cost $2.00
      // Multiplier 7.75 -> Standard = $15.50
      // Added 6% -> $16.43
      // Bowl: 10" Width, 5" Height
      // ES = (10*1) + (5*1) = 15
      // Size Comp = 15 * 3.50 = $52.50
      // Weighted = ($16.12 * 0.60) + ($52.50 * 0.40)
      // Weighted = $9.672 + $21.00 = $28.872 (using 3.2 per inch from mock)
      // Round to 2,4,5,8,9 -> 28.872 closest to 29
      
      const result = calculatePrice(2.00, mockPricingData, { 
          itemType: 'bowl', 
          width: 10, 
          height: 5 
      });
      expect(result.finalPrice).toBe(29);
  });

  it('calculates price effectively for an expensive small bowl', () => {
      // Cost $12.00
      // Multiplier 4 -> Standard = $48.00
      // Added 4% -> $49.92
      // Bowl: 6" Width, 3" Height
      // ES = 9
      // Size Comp = 9 * 3.50 = $31.50
      // Weighted = ($49.92 * 0.60) + ($31.50 * 0.40)
      // Weighted = ($49.92 * 0.60) + (28.8 * 0.40) (using 3.2 per inch)
      // Weighted = $29.952 + $11.52 = $41.472
      // Round to 2,4,5,8,9 -> 41.472 closest to 42
      
      const result = calculatePrice(12.00, mockPricingData, { 
          itemType: 'bowl', 
          width: 6, 
          height: 3 
      });
      expect(result.finalPrice).toBe(42);
  });

  it('falls back to standard pricing if width/height missing', () => {
      // Cost $2.00 -> Standard $15.50 -> +4% -> $16.12 
      // Round to 2,4,5,8,9 -> 16.12 closest to 15
      const result = calculatePrice(2.00, mockPricingData, { 
          itemType: 'bowl' 
          // Missing width/height
      });
      expect(result.finalPrice).toBe(15);
  });
});
