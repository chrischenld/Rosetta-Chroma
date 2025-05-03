var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { generateColorRamp } from "../utils/colorRamp";
import * as culori from "culori";
/**
 * Generate a Figma-friendly color ramp from a seed color
 * @param seedColor - Hex color code to generate the ramp from
 * @returns Object with color stops as RGBA values for Figma
 */
export function generateFigmaColorRamp(seedColor) {
    const colorRamp = generateColorRamp(seedColor);
    const figmaRamp = {};
    // Convert each color to Figma-friendly RGBA format (0-1 range)
    Object.entries(colorRamp).forEach(([key, value]) => {
        // Convert to RGB format first
        const color = culori.rgb(value);
        if (color) {
            figmaRamp[key] = {
                r: color.r,
                g: color.g,
                b: color.b,
                a: color.alpha !== undefined ? color.alpha : 1,
            };
        }
    });
    return figmaRamp;
}
/**
 * Apply a color ramp to Figma color styles
 * @param colorRamp - The color ramp object
 * @param namePrefix - Prefix for the style names (e.g., "Primary/")
 */
export function applyColorRampToStyles(colorRamp, namePrefix) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get existing styles or create new ones
        const styles = yield figma.getLocalPaintStylesAsync();
        // For each color in the ramp
        for (const [key, color] of Object.entries(colorRamp)) {
            const styleName = `${namePrefix}/${key}`;
            // Find existing style or create a new one
            let style = styles.find((s) => s.name === styleName);
            if (!style) {
                style = figma.createPaintStyle();
                style.name = styleName;
            }
            // Set the style's paint to the color
            const paint = {
                type: "SOLID",
                color: {
                    r: color.r,
                    g: color.g,
                    b: color.b,
                },
                opacity: color.a,
            };
            style.paints = [paint];
        }
    });
}
/**
 * Example usage in a Figma plugin:
 *
 * figma.showUI(__html__);
 *
 * figma.ui.onmessage = async (msg) => {
 *   if (msg.type === 'generate-ramp') {
 *     const seedColor = msg.color; // Hex color from UI
 *     const colorRamp = generateFigmaColorRamp(seedColor);
 *
 *     // Apply to styles
 *     await applyColorRampToStyles(colorRamp, msg.name || 'Primary');
 *
 *     // Notify UI that styles were created
 *     figma.ui.postMessage({
 *       type: 'ramp-generated',
 *       ramp: colorRamp
 *     });
 *   }
 * };
 */
