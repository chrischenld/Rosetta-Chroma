import * as culori from "culori";
const { parse, wcagContrast, formatHex, oklch } = culori;
// Contrast targets for each step in the color ramp
const CONTRAST_TARGETS = {
    "100": 12,
    "200": 8,
    "300": 5.5,
    "400": 4.5,
    "500": 3,
    "600": 2.5,
    "700": 1.4,
    "800": 1.2,
    "900": 1,
    "950": 1, // Slightly lighter than 900
};
/**
 * Generate a color ramp from a seed color using WCAG contrast targets
 * @param seedColor - The starting color (hex code) to generate the ramp from
 * @returns An object with color stops in OKLCH format
 */
export function generateColorRamp(seedColor) {
    // Parse the seed color to get its components
    const parsed = parse(seedColor);
    if (!parsed) {
        throw new Error(`Invalid color: ${seedColor}`);
    }
    // Convert to OKLCH for easier manipulation
    const oklchSeed = oklch(parsed);
    // White reference for contrast calculation
    const WHITE = parse("#ffffff");
    if (!WHITE) {
        throw new Error("Failed to parse white reference color");
    }
    const ramp = {};
    // Generate each color in the ramp
    Object.entries(CONTRAST_TARGETS).forEach(([step, targetContrast]) => {
        // Start with the seed color converted to OKLCH
        const color = Object.assign({}, oklchSeed);
        // Binary search to find the lightness that gives us the desired contrast
        let min = 0;
        let max = 1;
        let current = color.l;
        let iterations = 0;
        const maxIterations = 20; // Prevent infinite loops
        while (iterations < maxIterations) {
            // Convert current color to sRGB to calculate contrast
            color.l = current;
            const currentColor = formatHex(color);
            const currentContrast = wcagContrast(currentColor, WHITE);
            // If we're close enough to the target contrast, we're done
            if (Math.abs(currentContrast - targetContrast) < 0.01) {
                break;
            }
            if (currentContrast > targetContrast) {
                // Current color has too much contrast, needs to be lighter
                min = current;
                current = (current + max) / 2;
            }
            else {
                // Current color has too little contrast, needs to be darker
                max = current;
                current = (current + min) / 2;
            }
            iterations++;
        }
        // Special case for 950 which should be slightly lighter than 900
        if (step === "950" && ramp["900"]) {
            const parsed900 = parse(ramp["900"]);
            if (parsed900) {
                const color900 = oklch(parsed900);
                // Make 950 slightly lighter than 900
                color.l = Math.min(color900.l + 0.02, 1);
            }
        }
        // Store the color in the ramp
        ramp[step] = `oklch(${color.l} ${color.c} ${color.h})`;
    });
    return ramp;
}
