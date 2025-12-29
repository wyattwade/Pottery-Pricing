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
