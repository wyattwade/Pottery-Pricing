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
  vendor?: string; // From data.json
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

// Product Attributes Interface
export interface ProductAttributes {
    itemType?: string;
    size?: number;
}

// Product Attributes Interface
export interface ProductAttributes {
    itemType?: string;
    size?: number;
}

export function calculatePrice(cost: number, data: PricingData, attributes: ProductAttributes = {}): CalculationResult {
  // 1. Find the range
  let range = data.pricingMatrix.find(
    (m) => cost >= m.minCost && cost <= m.maxCost
  );

  // Fallback for costs higher than the highest defined tier
  if (!range) {
      const maxTier = data.pricingMatrix.reduce((prev, current) => (prev.maxCost > current.maxCost) ? prev : current);
      if (cost > maxTier.maxCost) {
          range = maxTier;
      }
  }

  if (!range) {
    throw new Error(`No pricing tier found for cost $${cost}`);
  }

  // --- Start Pricing Calculation ---

  let finalPrice = 0;
  let adjustedPrice = 0;
  const appliedRules: AppliedRule[] = [];
  
  // Filter active rules
  let activeRules = data.rules.filter((r) => r.isActive);

  // Ensure defaults (safety check if not coming from sanitized source)
  if (!activeRules.some(r => r.name === 'addedMultiplier')) {
      activeRules.push({ id: -1, name: 'addedMultiplier', value: 8, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 });
  }
  if (!activeRules.some(r => r.type === 'ROUND_NEAREST')) {
      activeRules.push({ id: -2, name: 'roundToDollar', value: 1.0, type: 'ROUND_NEAREST', isActive: true, userId: 1 });
  }

  // --- Logic for Plates with Size ---
  const isPlate = attributes.itemType === 'plate' || attributes.itemType === 'plates/bowls'; 
  const hasSize = attributes.size && attributes.size > 0;
  
  if (isPlate && hasSize) {
      // Get relevant rules for formula
      const rPricePerInch = activeRules.find(r => r.name === 'platePricePerInch')?.value ?? 3.0;
      const rCostWeight = activeRules.find(r => r.name === 'plateCostWeight')?.value ?? 0.65;
      const rSizeWeight = activeRules.find(r => r.name === 'plateSizeWeight')?.value ?? 0.35;

      // 1. Cost Component: (Cost * Multiplier)
      // Standard multiplier from matrix
      let standardPrice = cost * range.multiplier;
      
      // Apply percentage adds (like 8% markup) to this standard price
      for (const rule of activeRules) {
        if (rule.type === 'PERCENTAGE_ADD') {
            standardPrice += (standardPrice * (rule.value / 100));
        }
      }

      // 2. Size Component: (Size * PricePerInch)
      const sizeComp = (attributes.size!) * rPricePerInch;

      // 3. Weighted Formula
      const weightedCostPart = standardPrice * rCostWeight;
      const weightedSizePart = sizeComp * rSizeWeight;
      
      const plateFormulaPrice = weightedCostPart + weightedSizePart;
      
      // Difference from standard
      const diff = plateFormulaPrice - standardPrice;

      // Set base to standard, apply difference as rule
      finalPrice = standardPrice;
      adjustedPrice = plateFormulaPrice;
      
      appliedRules.push({
          name: 'Plate Size Adjustment',
          value: attributes.size!,
          addedAmount: Number(diff.toFixed(2)),
          label: `(Formula [$${weightedCostPart.toFixed(2)} + $${weightedSizePart.toFixed(2)}] vs Std $${standardPrice.toFixed(2)})`
      });

  } else {
      // --- Standard Logic ---
      finalPrice = cost * range.multiplier;
      adjustedPrice = finalPrice;

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
  }

  // --- Common Final Steps (Rounding & Minimums) ---

  // 3. Apply Rounding Rule
  const roundingRule = activeRules.find((r) => r.type === 'ROUND_NEAREST');
  if (roundingRule) {
    const preRoundPrice = adjustedPrice;
    const step = roundingRule.value; // e.g., 1.0
    adjustedPrice = Math.round(adjustedPrice / step) * step;

    if (Math.abs(adjustedPrice - preRoundPrice) > 0.001) {
        appliedRules.push({
        name: roundingRule.name,
        value: roundingRule.value,
        addedAmount: Number((adjustedPrice - preRoundPrice).toFixed(2)),
        label: '',
        });
    }
  }

  // 3.5 Apply "Minus One" Rule 
  const minusOneRule = activeRules.find(r => r.name === 'roundMultiple10Minus1');
  if (minusOneRule && adjustedPrice > 0) {
      if (adjustedPrice % 10 === 0) {
          const preAdjust = adjustedPrice;
          adjustedPrice -= minusOneRule.value;
           appliedRules.push({
              name: 'Minus One (Multiple of 10)',
              value: minusOneRule.value,
              addedAmount: Number((adjustedPrice - preAdjust).toFixed(2)),
              label: '(-$1)'
          });
      }
  }

  // 4. Apply Minimum Price Rule (Generic)
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

  // 4.5 Apply Mug Minimum Rule
  const mugMinRule = activeRules.find(r => r.name === 'mugMinPrice');
  if (mugMinRule && attributes.itemType === 'cups/mugs') {
      if (adjustedPrice < mugMinRule.value) {
          const preMugMin = adjustedPrice;
          adjustedPrice = mugMinRule.value;
          appliedRules.push({
              name: 'Mug Minimum',
              value: mugMinRule.value,
              addedAmount: Number((adjustedPrice - preMugMin).toFixed(2)),
              label: `(Min $${mugMinRule.value})`
          });
      }
  }

  // 4.6 Apply Plate Minimum Rule
  const plateMinRule = activeRules.find(r => r.name === 'plateMinPrice');
  const isPlateType = attributes.itemType === 'plate' || attributes.itemType === 'plates/bowls';
  if (plateMinRule && isPlateType) {
       if (adjustedPrice < plateMinRule.value) {
          const prePlateMin = adjustedPrice;
          adjustedPrice = plateMinRule.value;
          appliedRules.push({
              name: 'Plate Minimum',
              value: plateMinRule.value,
              addedAmount: Number((adjustedPrice - prePlateMin).toFixed(2)),
              label: `(Min $${plateMinRule.value})`
          });
      }
  }

  // 5. Apply Figurine Specific Logic
  if (attributes.itemType === 'small-figurines') {
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

  // 6. Apply Max Markup Rule (NEW)
  // Ensures Price <= Cost + MaxMarkup
  const maxMarkupRule = activeRules.find(r => r.name === 'maxMarkupAmount');
  if (maxMarkupRule) {
      const maxAllowedPrice = cost + maxMarkupRule.value;
      if (adjustedPrice > maxAllowedPrice) {
          const preMaxCap = adjustedPrice;
          adjustedPrice = maxAllowedPrice;
          
          appliedRules.push({
            name: 'Max Markup Cap',
            value: maxMarkupRule.value,
            addedAmount: Number((adjustedPrice - preMaxCap).toFixed(2)),
            label: `(Cap at Cost + $${maxMarkupRule.value})`
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

export function calculatePriceBySku(sku: string, data: PricingData, attributes: ProductAttributes = {}): CalculationResult {
  const product = data.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());

  if (!product) {
    throw new Error(`Product with SKU ${sku} not found`);
  }

  const result = calculatePrice(product.cost, data, attributes);
  return {
    ...result,
    productName: product.name
  };
}
