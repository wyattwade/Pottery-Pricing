import { Rule, PricingData } from './pricing';

const STORAGE_KEY = 'pottery_pricing_rules';

export function getStoredRules(): Rule[] | null {
  if (typeof window === 'undefined') return null; // Server-side check
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse stored rules', e);
    return null;
  }
}

export function saveRules(rules: Rule[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
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

    // 1. Force addedMultiplier to 8% if it represents the legacy default (10)
    // OR if it's missing.
    const addedMult = newRules.find(r => r.name === 'addedMultiplier');
    if (addedMult) {
        // If it's exactly 10 (the old default), reset to 8. 
        // If it's something else (e.g. user saved it in DB as 12), we might be overwriting it?
        // User requested "It's currently 8 in config ... This should apply to all ... They should be variables".
        // To be safe and compliant with the request "default is 8%", we force it to 8.
        if (addedMult.value === 10) {
            addedMult.value = 8;
        }
    } else {
        newRules.push({ id: -1, name: 'addedMultiplier', value: 8, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 });
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
            value: 20, 
            type: 'MIN_FIXED_MUG', 
            isActive: true, 
            userId: 1 
        });
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

    return newRules;
}

export async function fetchPricingData(basePath: string = ''): Promise<PricingData> {
    try {
        const res = await fetch(`${basePath}/data.json`);
        const data: PricingData = await res.json();
        
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
