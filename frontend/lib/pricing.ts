export interface PricingMatrix {
  id: number;
  minCost: number;
  maxCost: number;
  multiplier: number;
  userId: number;
}

export interface Rule {
  id: number;
  name: string;
  value: number;
  type: string; // 'PERCENTAGE_ADD', 'ROUND_NEAREST', 'MIN_FIXED'
  isActive: boolean;
  userId: number;
}

export interface Product {
  id: number;
  sku: string;
  cost: number;
  vendorId: number;
  vendorName: string;
  name?: string;
}

export interface PricingData {
  pricingMatrix: PricingMatrix[];
  rules: Rule[];
  products: Product[];
}

export interface AppliedRule {
  name: string;
  value: number;
  addedAmount: number;
  label: string;
}

export interface CalculationResult {
  cost: number;
  multiplier: number;
  basePrice: number;
  finalPrice: number;
  appliedRules: AppliedRule[];
  productName?: string;
}

export function calculatePrice(cost: number, data: PricingData, itemType?: string): CalculationResult {
  // 1. Find the range
  const range = data.pricingMatrix.find(
    (m) => cost >= m.minCost && cost <= m.maxCost
  );

  if (!range) {
    throw new Error(`No pricing tier found for cost $${cost}`);
  }

  const finalPrice = cost * range.multiplier;
  let adjustedPrice = finalPrice;
  const appliedRules: AppliedRule[] = [];

  // Filter active rules for userId: 1
  let activeRules = data.rules.filter((r) => r.isActive);

  // Default addedMultiplier (8%)
  if (!activeRules.some(r => r.name === 'addedMultiplier')) {
      activeRules.push({
          id: -1,
          name: 'addedMultiplier',
          value: 8,
          type: 'PERCENTAGE_ADD',
          isActive: true,
          userId: 1
      });
  }

  // Default roundToDollar (TRUE / 1.0)
  if (!activeRules.some(r => r.type === 'ROUND_NEAREST')) {
      activeRules.push({
          id: -2,
          name: 'roundToDollar',
          value: 1.0,
          type: 'ROUND_NEAREST',
          isActive: true,
          userId: 1
      });
  }

  // 2. Apply Percentage Rules
  for (const rule of activeRules) {
    if (rule.type === 'PERCENTAGE_ADD') {
      const addedAmount = finalPrice * (rule.value / 100);
      adjustedPrice += addedAmount;
      appliedRules.push({
        name: rule.name,
        value: rule.value,
        addedAmount: Number(addedAmount.toFixed(2)),
        label: `(${rule.value}%)`,
      });
    }
  }

  // 3. Apply Rounding Rule
  const roundingRule = activeRules.find((r) => r.type === 'ROUND_NEAREST');
  if (roundingRule) {
    const preRoundPrice = adjustedPrice;
    const step = roundingRule.value; // e.g., 1.0
    adjustedPrice = Math.round(adjustedPrice / step) * step;

    appliedRules.push({
      name: roundingRule.name,
      value: roundingRule.value,
      addedAmount: Number((adjustedPrice - preRoundPrice).toFixed(2)),
      label: '',
    });
  }

  // 4. Apply Minimum Price Rule
  const minPriceRule = activeRules.find((r) => r.type === 'MIN_FIXED');
  if (minPriceRule && adjustedPrice < minPriceRule.value) {
    const preMinPrice = adjustedPrice;
    adjustedPrice = minPriceRule.value;

    appliedRules.push({
      name: minPriceRule.name,
      value: minPriceRule.value,
      addedAmount: Number((adjustedPrice - preMinPrice).toFixed(2)),
      label: '',
    });
  }

  // 5. Apply Figurine Specific Logic
  if (itemType === 'small-figurines') {
    const figDiscount = activeRules.find((r) => r.name === 'smallFigurineDiscount');
    const figMin = activeRules.find((r) => r.name === 'smallFigurineMinPrice');

    if (figDiscount && figMin) {
        const preFigPrice = adjustedPrice;
        const discount = figDiscount.value; // 10
        const floor = figMin.value; // 22

        let calculated = adjustedPrice - discount;
        if (calculated < floor) {
            calculated = floor;
        }
        
        // Adjust the price
        adjustedPrice = calculated;
        
        appliedRules.push({
            name: 'Small Figurine Adjustment',
            value: discount,
            addedAmount: Number((adjustedPrice - preFigPrice).toFixed(2)),
            label: ''
        });
    }
}

  return {
    cost,
    multiplier: range.multiplier,
    basePrice: Number(finalPrice.toFixed(2)),
    finalPrice: Number(adjustedPrice.toFixed(2)),
    appliedRules,
  };
}

export function calculatePriceBySku(sku: string, data: PricingData, itemType?: string): CalculationResult {
  const product = data.products.find((p) => p.sku === sku);

  if (!product) {
    throw new Error(`Product with SKU ${sku} not found`);
  }

  const result = calculatePrice(product.cost, data, itemType);
  return {
    ...result,
    productName: product.name
  };
}
