export interface PricingMatrix {
  id: number;
  minCost: number;
  maxCost: number;
  multiplier: number;
  originalMultiplier?: number;
  userId: number;
  comment?: string;
}

export interface Rule {
  id: number;
  name: string;
  value: number;
  type: string; // 'PERCENTAGE_ADD', 'ROUND_NEAREST', 'MIN_FIXED'
  isActive: boolean;
  userId: number;
  comment?: string;
}

export interface Product {
  id: number;
  sku: string;
  cost: number;
  vendorId: number;
  vendorName: string;
  vendor?: string; // From data.json
  name?: string;
  comment?: string;
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
    size?: number;   // Main size (e.g. Diameter for plates)
    width?: number;
    height?: number;
}

// Plain-English explanation of a size-blended price, shown under the rule name in the UI.
// e.g. "65% of the cost price ($15.00 × 3.75 + 8% = $60.75 → $39.49) + 35% of the size price (20" × $3.00/in = $60.00 → $21.00) = $60.49, replacing $60.75"
function sizeBlendLabel(
  baseDesc: string, base: number,
  costWeight: number, standardPrice: number,
  sizeWeight: number, sizeDesc: string, pricePerInch: number, sizeComp: number,
  blended: number
): string {
  const pct = (w: number) => `${Math.round(w * 100)}%`;
  const usd = (n: number) => `$${n.toFixed(2)}`;
  // Back out whatever percentage add(s) turned the base into standardPrice
  const markupPct = Math.round((standardPrice / base - 1) * 100);
  const markup = markupPct !== 0 ? ` + ${markupPct}%` : '';
  return `${pct(costWeight)} of the cost price (${baseDesc}${markup} = ${usd(standardPrice)} → ${usd(standardPrice * costWeight)})`
    + ` + ${pct(sizeWeight)} of the size price (${sizeDesc} × ${usd(pricePerInch)}/in = ${usd(sizeComp)} → ${usd(sizeComp * sizeWeight)})`
    + ` = ${usd(blended)}, replacing ${usd(standardPrice)}`;
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

  // Never-drop rule: an item is never priced below the top of a lower tier.
  // Multipliers step down at each tier edge faster than cost rises, so without
  // this a $3.51 item would price below a $3.50 one.
  const rawBase = cost * range.multiplier;
  let floorBase = 0;
  let floorCost = 0;
  for (const m of data.pricingMatrix) {
    if (m.maxCost < cost && m.maxCost * m.multiplier > floorBase) {
      floorBase = m.maxCost * m.multiplier;
      floorCost = m.maxCost;
    }
  }
  const tierBase = Math.max(rawBase, floorBase);
  const baseDesc = tierBase > rawBase
    ? `$${tierBase.toFixed(2)} tier floor`
    : `$${cost.toFixed(2)} × ${range.multiplier}`;

  // --- Start Pricing Calculation ---

  let finalPrice = 0;
  let adjustedPrice = 0;
  const appliedRules: AppliedRule[] = [];

  // Shows the never-drop lift in the breakdown. `factor` puts it on the same
  // footing as the displayed base price (sized items show base after markup).
  const pushTierFloor = (factor: number) => {
    if (tierBase <= rawBase) return;
    appliedRules.push({
      name: 'Tier Floor',
      value: tierBase,
      addedAmount: Number(((tierBase - rawBase) * factor).toFixed(2)),
      label: `Never priced below a $${floorCost.toFixed(2)} item (base $${rawBase.toFixed(2)} raised to $${tierBase.toFixed(2)})`,
    });
  };
  
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
      let standardPrice = tierBase;

      // Apply percentage adds (like 8% markup) to this standard price
      for (const rule of activeRules) {
        if (rule.type === 'PERCENTAGE_ADD') {
            standardPrice += (standardPrice * (rule.value / 100));
        }
      }
      const markupFactor = standardPrice / tierBase;

      // 2. Size Component: (Size * PricePerInch)
      const sizeComp = (attributes.size!) * rPricePerInch;

      // 3. Weighted Formula
      const weightedCostPart = standardPrice * rCostWeight;
      const weightedSizePart = sizeComp * rSizeWeight;
      
      const plateFormulaPrice = weightedCostPart + weightedSizePart;
      
      // Difference from standard
      const diff = plateFormulaPrice - standardPrice;

      // Set base to standard, apply difference as rule
      finalPrice = rawBase * markupFactor;
      adjustedPrice = plateFormulaPrice;
      pushTierFloor(markupFactor);

      appliedRules.push({
          name: `Plate Size Adjustment (${attributes.size}")`,
          value: attributes.size!,
          addedAmount: Number(diff.toFixed(2)),
          label: sizeBlendLabel(baseDesc, tierBase, rCostWeight, standardPrice, rSizeWeight, `${attributes.size}"`, rPricePerInch, sizeComp, plateFormulaPrice)
      });

  } else if (attributes.itemType === 'bowl' && attributes.width && attributes.height) {
     // --- Logic for Bowls ---
     const rPricePerInch = activeRules.find(r => r.name === 'bowlPricePerInch')?.value ?? 3.2;
     const rWidthWeight = activeRules.find(r => r.name === 'bowlWidthWeight')?.value ?? 1.0;
     const rHeightWeight = activeRules.find(r => r.name === 'bowlHeightWeight')?.value ?? 1.0;
     const rCostWeight = activeRules.find(r => r.name === 'bowlCostWeight')?.value ?? 0.60;
     const rSizeWeight = activeRules.find(r => r.name === 'bowlSizeWeight')?.value ?? 0.40;

     // 1. Standard Price Calculation
     let standardPrice = tierBase;
     for (const rule of activeRules) {
        if (rule.type === 'PERCENTAGE_ADD') {
            standardPrice += (standardPrice * (rule.value / 100));
        }
     }
     const markupFactor = standardPrice / tierBase;

     // 2. Effective Size Calculation
     const effectiveSize = (attributes.width * rWidthWeight) + (attributes.height * rHeightWeight);

     // 3. Size Component
     const sizeComp = effectiveSize * rPricePerInch;

     // 4. Weighted Formula
     const weightedCostPart = standardPrice * rCostWeight;
     const weightedSizePart = sizeComp * rSizeWeight;
     
     const bowlFormulaPrice = weightedCostPart + weightedSizePart;
     const diff = bowlFormulaPrice - standardPrice;

     finalPrice = rawBase * markupFactor;
     adjustedPrice = bowlFormulaPrice;
     pushTierFloor(markupFactor);

     appliedRules.push({
          name: `Bowl Size Adjustment (${attributes.width}" × ${attributes.height}")`,
          value: effectiveSize,
          addedAmount: Number(diff.toFixed(2)),
          label: sizeBlendLabel(baseDesc, tierBase, rCostWeight, standardPrice, rSizeWeight, `${attributes.width}" wide + ${attributes.height}" tall = ${effectiveSize}"`, rPricePerInch, sizeComp, bowlFormulaPrice)
      });

   } else if (attributes.itemType === 'cups/mugs' && attributes.width && attributes.height) {
     const rPricePerInch = activeRules.find(r => r.name === 'mugPricePerInch')?.value ?? 3.4;
     const rWidthWeight = activeRules.find(r => r.name === 'mugWidthWeight')?.value ?? 1.0;
     const rHeightWeight = activeRules.find(r => r.name === 'mugHeightWeight')?.value ?? 1.0;
     const rCostWeight = activeRules.find(r => r.name === 'mugCostWeight')?.value ?? 0.80;
     const rSizeWeight = activeRules.find(r => r.name === 'mugSizeWeight')?.value ?? 0.20;

     let standardPrice = tierBase;
     for (const rule of activeRules) {
        if (rule.type === 'PERCENTAGE_ADD') {
            standardPrice += (standardPrice * (rule.value / 100));
        }
     }
     const markupFactor = standardPrice / tierBase;

     const effectiveSize = (attributes.width * rWidthWeight) + (attributes.height * rHeightWeight);
     const sizeComp = effectiveSize * rPricePerInch;
     const weightedCostPart = standardPrice * rCostWeight;
     const weightedSizePart = sizeComp * rSizeWeight;
     
     const mugFormulaPrice = weightedCostPart + weightedSizePart;
     const diff = mugFormulaPrice - standardPrice;

     finalPrice = rawBase * markupFactor;
     adjustedPrice = mugFormulaPrice;
     pushTierFloor(markupFactor);

     appliedRules.push({
          name: `Mug Size Adjustment (${attributes.width}" × ${attributes.height}")`,
          value: effectiveSize,
          addedAmount: Number(diff.toFixed(2)),
          label: sizeBlendLabel(baseDesc, tierBase, rCostWeight, standardPrice, rSizeWeight, `${attributes.width}" wide + ${attributes.height}" tall = ${effectiveSize}"`, rPricePerInch, sizeComp, mugFormulaPrice)
      });

  } else {
      // --- Standard Logic ---
      finalPrice = rawBase;
      adjustedPrice = tierBase;
      pushTierFloor(1);

      // 2. Apply Percentage Rules
      for (const rule of activeRules) {
        if (rule.type === 'PERCENTAGE_ADD') {
          const addedAmount = tierBase * (rule.value / 100);
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

  // 3. Rounding: nearest whole dollar, using the roundToDollar rule (default $1).
  // Ties (x.50) round up. Prices in blockedPrices are skipped: the result moves
  // to whichever allowed neighbour is closer to the raw price.
  const blockedPrices = [33, 43, 53, 66, 83, 93];
  const roundTo = activeRules.find(r => r.type === 'ROUND_NEAREST')?.value || 1;
  const currentVal = adjustedPrice;
  const nearestPrice = Math.round(currentVal / roundTo) * roundTo;
  let bestPrice = nearestPrice;
  if (blockedPrices.includes(bestPrice)) {
      let down = bestPrice - roundTo;
      let up = bestPrice + roundTo;
      while (blockedPrices.includes(down)) down -= roundTo;
      while (blockedPrices.includes(up)) up += roundTo;
      bestPrice = (currentVal - down < up - currentVal) ? down : up;
  }

  // Price psychology rounding (endings 2, 4, 5, 8, 9) — disabled.
  // To restore: uncomment this block and delete the nearest-dollar rounding above.
  //
  // const validEndings = [2, 4, 5, 8, 9];
  // const lower = Math.floor(currentVal / 10) * 10;
  //
  // // Find candidates around the current value
  // let candidates: number[] = [];
  //
  // // Add candidates from current decade, previous decade, and next decade to be safe
  // [-10, 0, 10].forEach(offset => {
  //     validEndings.forEach(end => {
  //         candidates.push(lower + offset + end);
  //     });
  // });
  //
  // // Filter out negative prices if any
  // candidates = candidates.filter(c => c >= 0);
  //
  // // Find the closest candidate
  // // If tie, pick the higher price (business preference usually)
  // const bestPrice = candidates.reduce((prev, curr) => {
  //     const prevDiff = Math.abs(prev - currentVal);
  //     const currDiff = Math.abs(curr - currentVal);
  //     if (currDiff < prevDiff) return curr;
  //     if (currDiff === prevDiff) return curr > prev ? curr : prev;
  //     return prev;
  // });

  if (Math.abs(bestPrice - currentVal) > 0.001) {
      adjustedPrice = bestPrice;
      appliedRules.push({
          name: `Rounding (nearest $${roundTo})`,
          value: roundTo,
          addedAmount: Number((bestPrice - currentVal).toFixed(2)),
          label: bestPrice !== nearestPrice ? `$${nearestPrice} isn't used, so $${bestPrice}` : ''
      });
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
  if (attributes.itemType === 'small-figurines' || attributes.itemType === 'figurines') {
    // const figDiscount = activeRules.find((r) => r.name === 'smallFigurineDiscount'); // Removed discount logic
    const figMin = activeRules.find((r) => r.name === 'smallFigurineMinPrice');

    if (figMin) {
        const preFigPrice = adjustedPrice;
        const floor = figMin.value; // 21

        if (adjustedPrice < floor) {
            adjustedPrice = floor;
            
            appliedRules.push({
                name: 'Figurine Minimum',
                value: floor,
                addedAmount: Number((adjustedPrice - preFigPrice).toFixed(2)),
                label: `(Min $${floor})`
            });
        }
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
