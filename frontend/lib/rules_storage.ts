import { Rule, PricingData } from './pricing';

const STORAGE_KEY = 'pottery_pricing_rules';

export function getStoredRules(): Rule[] | null {
  // if (typeof window === 'undefined') return null; // Server-side check
  
  // const stored = localStorage.getItem(STORAGE_KEY);
  // if (!stored) return null;
  
  // try {
  //   return JSON.parse(stored);
  // } catch (e) {
  //   console.error('Failed to parse stored rules', e);
  //   return null;
  // }
  return null; // Disabled local storage
}

export function saveRules(rules: Rule[]) {
  // if (typeof window === 'undefined') return;
  // localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  // Disabled local storage
}


// --- Flagged SKUs Logic ---

export async function fetchFlaggedSkus(basePath: string = ''): Promise<string[]> {
    try {
        const res = await fetch(`${basePath}/flags.json`);
        if (!res.ok) return [];
        const skus: string[] = await res.json();
        return skus;
    } catch (e) {
        console.error('Failed to load flagged SKUs', e);
        return [];
    }
}

// Helper to sanitize/force defaults on raw JSON data
function sanitizeRules(rules: Rule[]): Rule[] {
    const newRules = [...rules];

    // 1. Force addedMultiplier to 4% (formerly 8%)
    const addedMult = newRules.find(r => r.name === 'addedMultiplier');
    if (addedMult) {
        addedMult.value = 4;
    } else {
        newRules.push({ id: -1, name: 'addedMultiplier', value: 4, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 });
    }

    // 2. Force roundToDollar to 1.0 (active)
    const roundRule = newRules.find(r => r.type === 'ROUND_NEAREST');
    if (roundRule) {
        if (roundRule.value !== 1.0) roundRule.value = 1.0;
        if (!roundRule.isActive) roundRule.isActive = true;
    } else {
        newRules.push({ id: -2, name: 'roundToDollar', value: 1.0, type: 'ROUND_NEAREST', isActive: true, userId: 1 });
    }

    // 3. Ensure 'Minus One' rule exists
    if (!newRules.some(r => r.name === 'roundMultiple10Minus1')) {
        newRules.push({ 
            id: -3, 
            name: 'roundMultiple10Minus1', 
            value: 1, 
            type: 'ADJUST_MULTIPLE_10', 
            isActive: true, 
            userId: 1 
        });
    }

    // 4. Ensure Mug Minimum rule exists
    if (!newRules.some(r => r.name === 'mugMinPrice')) {
        newRules.push({ 
            id: -4, 
            name: 'mugMinPrice', 
            value: 19, 
            type: 'MIN_FIXED_MUG', 
            isActive: true, 
            userId: 1 
        });
    } else {
        // Update existing to 19
        const mugMin = newRules.find(r => r.name === 'mugMinPrice');
        if (mugMin) mugMin.value = 19;
    }

    // 5. Plate Size Pricing Rules (Defaults)
    if (!newRules.some(r => r.name === 'platePricePerInch')) {
        newRules.push({ id: -5, name: 'platePricePerInch', value: 3.0, type: 'FACTOR_SIZE', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'plateCostWeight')) {
        newRules.push({ id: -6, name: 'plateCostWeight', value: 0.65, type: 'WEIGHT_COST', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'plateSizeWeight')) {
        newRules.push({ id: -7, name: 'plateSizeWeight', value: 0.35, type: 'WEIGHT_SIZE', isActive: true, userId: 1 });
    }

    // 6. Max Markup Rule
    if (!newRules.some(r => r.name === 'maxMarkupAmount')) {
        newRules.push({ id: -8, name: 'maxMarkupAmount', value: 90, type: 'MAX_MARKUP_CAP', isActive: true, userId: 1 });
    }

    // 7. Plate Minimum Price
    if (!newRules.some(r => r.name === 'plateMinPrice')) {
        newRules.push({ id: -9, name: 'plateMinPrice', value: 20, type: 'MIN_FIXED_PLATE', isActive: true, userId: 1 });
    }

    // 8. Bowl Pricing Rules (Defaults)
    if (!newRules.some(r => r.name === 'bowlPricePerInch')) {
        newRules.push({ id: -10, name: 'bowlPricePerInch', value: 3.2, type: 'FACTOR_SIZE_BOWL', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'bowlWidthWeight')) {
        newRules.push({ id: -11, name: 'bowlWidthWeight', value: 1.0, type: 'WEIGHT_WIDTH', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'bowlHeightWeight')) {
        newRules.push({ id: -12, name: 'bowlHeightWeight', value: 1.0, type: 'WEIGHT_HEIGHT', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'bowlCostWeight')) {
        newRules.push({ id: -13, name: 'bowlCostWeight', value: 0.60, type: 'WEIGHT_COST_BOWL', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'bowlSizeWeight')) {
        newRules.push({ id: -14, name: 'bowlSizeWeight', value: 0.40, type: 'WEIGHT_SIZE_BOWL', isActive: true, userId: 1 });
    }

    // 9. Mug Pricing Rules (New)
    if (!newRules.some(r => r.name === 'mugPricePerInch')) {
        newRules.push({ id: -15, name: 'mugPricePerInch', value: 3.4, type: 'FACTOR_SIZE_MUG', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'mugWidthWeight')) {
        newRules.push({ id: -16, name: 'mugWidthWeight', value: 1.0, type: 'WEIGHT_WIDTH_MUG', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'mugHeightWeight')) {
        newRules.push({ id: -17, name: 'mugHeightWeight', value: 1.0, type: 'WEIGHT_HEIGHT_MUG', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'mugCostWeight')) {
        newRules.push({ id: -18, name: 'mugCostWeight', value: 0.80, type: 'WEIGHT_COST_MUG', isActive: true, userId: 1 });
    }
    if (!newRules.some(r => r.name === 'mugSizeWeight')) {
        newRules.push({ id: -19, name: 'mugSizeWeight', value: 0.20, type: 'WEIGHT_SIZE_MUG', isActive: true, userId: 1 });
    }

    return newRules;
}

export async function fetchPricingData(basePath: string = ''): Promise<PricingData> {
    try {
        const timestamp = new Date().getTime();
        const res = await fetch(`${basePath}/data.json?t=${timestamp}`);
        const data: PricingData = await res.json();
        
        // Debugging: exact issue identifying
        if (data.products && data.products.length > 0) {
            console.log("Loaded data.json. First Product:", data.products[0]);
            if (data.products[0].cost === undefined) {
                console.error("CRITICAL: Product cost is undefined!");
            }
        }
        
        let rules = data.rules || [];

        // Check Local Storage first
        const storedRules = getStoredRules();

        if (storedRules && storedRules.length > 0) {
            // If we have stored rules, use them as the source of truth
            // BUT we still run sanitizeRules to catch legacy defaults (e.g. 10%) that were saved 
            // before the switch to 8%. Logic in sanitizeRules resets 10 -> 8.
            rules = sanitizeRules(storedRules);
            // Save back to ensure storage is updated with the fix
            saveRules(rules);
        } else {
            // Otherwise, use the JSON rules but sanitize them (force 8% default)
            rules = sanitizeRules(rules);
            // Save these sanitized defaults to storage so they persist as the user's "variables"
            saveRules(rules);
        }

        return {
            ...data,
            rules
        };
    } catch (error) {
        console.error("Failed to load pricing data", error);
        throw error;
    }
}

export function mergeRules(data: PricingData): PricingData {
    // Legacy helper, might still be useful if we have data passed in synchronously
    const storedRules = getStoredRules();
    if (storedRules && storedRules.length > 0) {
        return { ...data, rules: storedRules };
    }
    // If no stored rules, run sanitize just in case
    return { ...data, rules: sanitizeRules(data.rules || []) };
}
