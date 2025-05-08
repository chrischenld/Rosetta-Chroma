/// <reference types="@figma/plugin-typings" />

// Custom interface for RGB colors
interface RGBColor {
	r: number;
	g: number;
	b: number;
}

// Define a type for nodes that can have paint style IDs
interface _PaintStylesContainer {
	fillStyleId: string | symbol;
	strokeStyleId: string | symbol;
}

// Define different ramp flavor types
interface RampFlavor {
	name: string;
	description: string;
	chromaMultipliers: number[];
	lightnessAdjustment?: number[]; // Optional lightness adjustments
	hueShift?: number; // Optional hue shift in degrees
}

// Available ramp flavors
const RAMP_FLAVORS: Record<string, RampFlavor> = {
	bright: {
		name: "Default",
		description: "Emulates current Rosetta UI",
		chromaMultipliers: [
			0.7, // 100
			0.85, // 200
			0.95, // 300
			1.0, // 400 - Peak chroma
			0.95, // 500
			0.85, // 600
			0.7, // 700
			0.5, // 800
			0.3, // 900
			0.2, // 950
		],
	},
	stone: {
		name: "Stone",
		description: "Emulates more muted/lower saturation",
		chromaMultipliers: [
			0.35, // 100
			0.4, // 200
			0.45, // 300
			0.5, // 400 - Peak chroma
			0.45, // 500
			0.4, // 600
			0.2, // 700
			0.1, // 800
			0.05, // 900
			0.03, // 950
		],
	},
	concrete: {
		name: "Concrete",
		description: "An even lower saturation version of Stone",
		chromaMultipliers: [
			0.175, // 100
			0.2, // 200
			0.225, // 300
			0.25, // 400 - Peak chroma
			0.2, // 500
			0.175, // 600
			0.075, // 700
			0.05, // 800
			0.03, // 900
			0.01, // 950
		],
	},
	// cool: {
	// 	name: "Cool",
	// 	description: "Colors shifted towards cooler tones (blues/greens)",
	// 	chromaMultipliers: [
	// 		0.7, // 100
	// 		0.85, // 200
	// 		0.95, // 300
	// 		1.0, // 400
	// 		0.95, // 500
	// 		0.85, // 600
	// 		0.7, // 700
	// 		0.5, // 800
	// 		0.3, // 900
	// 		0.2, // 950
	// 	],
	// 	hueShift: -15, // Shift hue towards cooler colors
	// },
	// warm: {
	// 	name: "Warm",
	// 	description: "Colors shifted towards warmer tones (reds/oranges)",
	// 	chromaMultipliers: [
	// 		0.7, // 100
	// 		0.85, // 200
	// 		0.95, // 300
	// 		1.0, // 400
	// 		0.95, // 500
	// 		0.85, // 600
	// 		0.7, // 700
	// 		0.5, // 800
	// 		0.3, // 900
	// 		0.2, // 950
	// 	],
	// 	hueShift: 15, // Shift hue towards warmer colors
	// },
};

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 300, height: 760 });

// Get color from selection and send to UI
function sendSelectedColor() {
	const selection = figma.currentPage.selection;

	// Check if something is selected
	if (selection.length === 0) {
		figma.ui.postMessage({
			type: "no-selection",
			message: "Please select a layer with a fill",
		});
		return;
	}

	// Get the first selected node
	const node = selection[0];

	// Check if this is a ramp frame by name
	const isRampFrame = checkIfRampFrame(node);

	// Check if the node has fills
	if ("fills" in node && Array.isArray(node.fills) && node.fills.length > 0) {
		// Find the first solid fill
		const solidFill = node.fills.find(
			(fill) => fill.type === "SOLID"
		) as SolidPaint;

		if (solidFill) {
			// Convert RGB to hex
			const color = solidFill.color;
			const hex = rgbToHex(color.r, color.g, color.b);

			// Calculate contrast with white
			const whiteRGB: RGBColor = { r: 1, g: 1, b: 1 };
			const selectedRGB: RGBColor = { r: color.r, g: color.g, b: color.b };
			const contrastRatio = contrast(selectedRGB, whiteRGB);

			// Get LCH values
			const lch = rgbToOklch(selectedRGB);

			// Send color to UI along with available ramp flavors
			figma.ui.postMessage({
				type: "selected-color",
				color: hex,
				opacity: solidFill.opacity || 1,
				contrastRatio: contrastRatio.toFixed(1),
				lch: {
					l: lch.l.toFixed(2),
					c: lch.c.toFixed(2),
					h: Math.round(lch.h),
				},
				isRampFrame: isRampFrame,
				flavors: Object.keys(RAMP_FLAVORS).map((key) => ({
					id: key,
					name: RAMP_FLAVORS[key].name,
					description: RAMP_FLAVORS[key].description,
				})),
			});
		} else {
			figma.ui.postMessage({
				type: "no-fill",
				message: "Selected layer has no solid fill",
				isRampFrame: isRampFrame,
			});
		}
	} else {
		figma.ui.postMessage({
			type: "no-fill",
			message: "Selected layer has no fill property",
			isRampFrame: isRampFrame,
		});
	}
}

// Check if the selected node is a ramp frame
function checkIfRampFrame(node: SceneNode): boolean {
	// Check if it's a frame and name starts with [Ramp]
	if (node.type === "FRAME" && node.name.startsWith("[Ramp]")) {
		// Check if it has children that might be color swatches
		if ("children" in node && node.children.length >= 5) {
			// Make sure most children have solid fills (they're color swatches)
			const solidFills = node.children.filter(
				(child) =>
					"fills" in child &&
					Array.isArray(child.fills) &&
					child.fills.length > 0 &&
					child.fills.some((fill) => fill.type === "SOLID")
			);

			// If at least 70% of children have solid fills, it's likely a ramp frame
			return solidFills.length >= node.children.length * 0.7;
		}
	}
	return false;
}

// Extract colors from a ramp frame
function extractColorsFromRampFrame(
	frame: FrameNode
): Array<{ name: string; color: RGBColor }> {
	const colors: Array<{ name: string; color: RGBColor }> = [];

	// Sort children by x position to get them in proper order
	const sortedChildren = [...frame.children].sort((a, b) => a.x - b.x);

	// Process each child node
	sortedChildren.forEach((child, index) => {
		if (
			"fills" in child &&
			Array.isArray(child.fills) &&
			child.fills.length > 0
		) {
			const solidFill = child.fills.find(
				(fill) => fill.type === "SOLID"
			) as SolidPaint;

			if (solidFill) {
				// Get step name from the node's name or generate based on index
				let stepName = child.name;
				if (
					!stepName ||
					stepName === "" ||
					stepName === "Rectangle" ||
					stepName === "Frame"
				) {
					// Common color step names
					const steps = [
						"100",
						"200",
						"300",
						"400",
						"500",
						"600",
						"700",
						"800",
						"900",
						"950",
					];
					stepName = steps[index] || index.toString();
				}

				colors.push({
					name: stepName,
					color: {
						r: solidFill.color.r,
						g: solidFill.color.g,
						b: solidFill.color.b,
					},
				});
			}
		}
	});

	return colors;
}

// Define a type for chroma curve settings
interface ChromaCurveSettings {
	peakChroma: number; // 0-100 percentage
	peakPosition: string; // step ID where chroma peaks ("100", "200", etc.)
	falloffRate: string; // "gentle", "moderate", "steep", "extreme"
	customStops?: Record<string, number>; // Custom values for individual stops (0-1)
}

// Define message type for UI communication
interface UiMessage {
	type: string;
	color?: string;
	flavor?: string;
	colorName?: string;
	organizationStyle?: "flat" | "nested";
	createVariables?: boolean;
	createStyles?: boolean;
	variableId?: string;
	newColorGroup?: string;
	isAdvancedMode?: boolean;
	customContrastTargets?: Record<string, number>;
	chromaCurveSettings?: ChromaCurveSettings;
}

// Create color styles from a ramp
async function createColorStyles(
	colorName: string,
	colors: Array<{ name: string; color: RGBColor }>,
	organizationStyle: "flat" | "nested",
	createVariables: boolean = false,
	createStyles: boolean = true
): Promise<{ styles: number; variables: number }> {
	// Remove any characters that might not be valid in style names
	const sanitizedName = colorName.replace(/[^a-zA-Z0-9\s]/g, "").trim();
	let stylesCreated = 0;
	let variablesCreated = 0;

	// Create each color style
	for (const colorObj of colors) {
		let styleName: string;

		if (organizationStyle === "nested") {
			styleName = `${sanitizedName}/${colorObj.name}`;
		} else {
			styleName = `${sanitizedName}-${colorObj.name}`;
		}

		// Create paint style if requested
		if (createStyles) {
			const style = figma.createPaintStyle();
			style.name = styleName;
			style.paints = [
				{
					type: "SOLID",
					color: colorObj.color,
				},
			];
			stylesCreated++;
		}

		// If requested, also create variables
		if (createVariables) {
			try {
				// Use variableName as the final token name part (after the /)
				// and sanitizedName as the group name
				const variableName = styleName;
				const result = await createColorVariable(
					variableName,
					colorObj.color,
					sanitizedName
				);
				if (result) variablesCreated++;
			} catch (e) {
				console.error("Failed to create variable: ", e);
			}
		}
	}

	return { styles: stylesCreated, variables: variablesCreated };
}

// Create a Figma color variable
async function createColorVariable(
	name: string,
	color: RGBColor,
	groupName: string
): Promise<VariableAlias | null> {
	try {
		// First, get all collections using async API
		const collections =
			await figma.variables.getLocalVariableCollectionsAsync();

		// Try to find the "Colors" collection
		let collection = collections.find((c) => c.name.toLowerCase() === "colors");

		// If the Colors collection doesn't exist, create it
		if (!collection) {
			collection = figma.variables.createVariableCollection("Colors");
		}

		// Now get all variables in this collection using async API
		const allVariables = await figma.variables.getLocalVariablesAsync();

		// Use the groupName as a prefix for organizing in the Colors collection
		const fullVariableName = `${groupName}/${name.split("/").pop()}`;

		// Try to find an existing variable with the same name in this collection
		const existingVar = allVariables.find(
			(v) =>
				v.name === fullVariableName &&
				v.variableCollectionId === collection.id &&
				v.resolvedType === "COLOR"
		);

		// If the variable exists, update it; otherwise create a new one
		let colorVar;

		if (existingVar) {
			colorVar = existingVar;
		} else {
			// Create a new variable with the collection object (not just the ID)
			colorVar = figma.variables.createVariable(
				fullVariableName,
				collection,
				"COLOR"
			);
		}

		// Set the value for the default mode
		colorVar.setValueForMode(collection.defaultModeId, {
			r: color.r,
			g: color.g,
			b: color.b,
		});

		// Create and return a variable alias
		return figma.variables.createVariableAlias(colorVar);
	} catch (e) {
		console.error("Error creating variable:", e);
		return null;
	}
}

// Add a selection change listener to automatically update when selection changes
figma.on("selectionchange", () => {
	sendSelectedColor();
});

// Convert RGB values (0-1) to hex string
function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (value: number) => {
		const hex = Math.round(value * 255).toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	};

	return "#" + toHex(r) + toHex(g) + toHex(b);
}

// Convert hex to rgb
function hexToRgb(hex: string): RGBColor {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) {
		throw new Error(`Invalid hex color: ${hex}`);
	}

	return {
		r: parseInt(result[1], 16) / 255,
		g: parseInt(result[2], 16) / 255,
		b: parseInt(result[3], 16) / 255,
	};
}

// Convert RGB color to OKLCH-like format (our own implementation)
function rgbToOklch(color: RGBColor): { l: number; c: number; h: number } {
	// This is a simplified conversion - not accurate OKLCH but good enough for our needs
	// First convert to HSL which is easier
	const r = color.r;
	const g = color.g;
	const b = color.b;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (delta !== 0) {
		s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

		if (max === r) {
			h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
		} else if (max === g) {
			h = ((b - r) / delta + 2) * 60;
		} else {
			h = ((r - g) / delta + 4) * 60;
		}
	}

	// Convert HSL to OKLCH-like values
	// This is not accurate OKLCH but provides similar behavior
	const c = s * 0.4; // chroma approximation

	return { l, c, h };
}

// Convert OKLCH-like format back to RGB
function oklchToRgb(oklch: { l: number; c: number; h: number }): RGBColor {
	// This is a simplified conversion - not accurate OKLCH but good enough for our needs
	// First convert to HSL
	const l = oklch.l;
	const s = oklch.c * 2.5; // reverse chroma approximation
	const h = oklch.h;

	// Convert HSL to RGB
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r, g, b;

	if (0 <= h && h < 60) {
		[r, g, b] = [c, x, 0];
	} else if (60 <= h && h < 120) {
		[r, g, b] = [x, c, 0];
	} else if (120 <= h && h < 180) {
		[r, g, b] = [0, c, x];
	} else if (180 <= h && h < 240) {
		[r, g, b] = [0, x, c];
	} else if (240 <= h && h < 300) {
		[r, g, b] = [x, 0, c];
	} else {
		[r, g, b] = [c, 0, x];
	}

	return {
		r: Math.max(0, Math.min(1, r + m)),
		g: Math.max(0, Math.min(1, g + m)),
		b: Math.max(0, Math.min(1, b + m)),
	};
}

// WCAG contrast ratio calculation
function contrast(rgb1: RGBColor, rgb2: RGBColor): number {
	// Calculate luminance for each color
	function luminance(r: number, g: number, b: number): number {
		const a = [r, g, b].map((v) => {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
	}

	const lum1 = luminance(rgb1.r * 255, rgb1.g * 255, rgb1.b * 255);
	const lum2 = luminance(rgb2.r * 255, rgb2.g * 255, rgb2.b * 255);
	const brightest = Math.max(lum1, lum2);
	const darkest = Math.min(lum1, lum2);

	return (brightest + 0.05) / (darkest + 0.05);
}

// Generate a color ramp using our OKLCH-like color space for perceptually uniform adjustments
function generateColorRamp(
	seedColor: string,
	flavor: string = "bright",
	customContrastTargets?: Record<string, number>,
	chromaCurveSettings?: ChromaCurveSettings
): Record<string, RGBColor> {
	// Contrast targets for each step in the ramp
	const DEFAULT_CONTRAST_TARGETS: Record<string, number> = {
		"100": 12,
		"200": 8,
		"300": 5.5,
		"400": 4.5,
		"500": 3,
		"600": 2.5,
		"700": 1.4,
		"800": 1.2,
		"900": 1.1,
		"950": 1.05,
	};

	// Use custom contrast targets if provided, otherwise use defaults
	const CONTRAST_TARGETS = customContrastTargets || DEFAULT_CONTRAST_TARGETS;

	// Get the selected flavor or default to bright
	const selectedFlavor = RAMP_FLAVORS[flavor] || RAMP_FLAVORS.bright;

	// Convert hex to our RGBColor
	const rgbColor = hexToRgb(seedColor);

	// Convert to our OKLCH-like format
	const oklchSeed = rgbToOklch(rgbColor);

	// Define target curve shapes for lightness
	const lightnessShape = [
		0.15, // 100 - Very dark
		0.25, // 200
		0.35, // 300
		0.45, // 400
		0.55, // 500
		0.65, // 600
		0.78, // 700
		0.85, // 800
		0.93, // 900
		0.97, // 950 - Very light
	];

	// Determine chroma multipliers based on settings or flavor
	let chromaMultipliers: number[];
	const steps = [
		"100",
		"200",
		"300",
		"400",
		"500",
		"600",
		"700",
		"800",
		"900",
		"950",
	];

	if (chromaCurveSettings?.customStops) {
		// Use the custom stop values directly
		chromaMultipliers = steps.map((step) => {
			// For the peak, ensure it's at the peak chroma value
			if (step === chromaCurveSettings.peakPosition) {
				return chromaCurveSettings.peakChroma / 100;
			}

			// Use the custom value if available, otherwise use a fallback value
			return chromaCurveSettings.customStops?.[step] || 0.5;
		});
	} else if (chromaCurveSettings) {
		// Generate a custom chroma curve based on user settings
		chromaMultipliers = generateChromaCurve(chromaCurveSettings);
	} else {
		// Use the predefined chroma multipliers from the flavor
		chromaMultipliers = selectedFlavor.chromaMultipliers;
	}

	// Original seed chroma value
	const seedChroma = oklchSeed.c || 0.1;
	const seedHue = oklchSeed.h || 0;

	// White reference for contrast
	const WHITE: RGBColor = { r: 1, g: 1, b: 1 };
	const ramp: Record<string, RGBColor> = {};

	// Generate each color in the ramp
	steps.forEach((step, index) => {
		// Apply lightness adjustment if available
		let targetL = lightnessShape[index];
		if (
			selectedFlavor.lightnessAdjustment &&
			selectedFlavor.lightnessAdjustment[index]
		) {
			targetL += selectedFlavor.lightnessAdjustment[index];
			// Keep lightness within bounds
			targetL = Math.max(0, Math.min(1, targetL));
		}

		const targetC = seedChroma * chromaMultipliers[index];

		// Apply hue shift if available
		let targetH = seedHue;
		if (selectedFlavor.hueShift) {
			targetH = (seedHue + selectedFlavor.hueShift) % 360;
			if (targetH < 0) targetH += 360; // Handle negative values
		}

		const oklchColor = {
			l: targetL,
			c: targetC,
			h: targetH,
		};

		// Convert back to RGB for display
		const rgbColor = oklchToRgb(oklchColor);

		// Ensure the color is within RGB gamut
		const clampedRgb: RGBColor = {
			r: Math.max(0, Math.min(1, rgbColor.r)),
			g: Math.max(0, Math.min(1, rgbColor.g)),
			b: Math.max(0, Math.min(1, rgbColor.b)),
		};

		// Fine-tune lightness to hit contrast targets using binary search
		let min = 0;
		let max = 1;
		let currentLightness = targetL;
		let iterations = 0;
		const maxIterations = 10;

		// Use target contrast if it exists
		const targetContrast = CONTRAST_TARGETS[step];

		while (iterations < maxIterations) {
			const adjustedOklch = {
				l: currentLightness,
				c: targetC,
				h: targetH,
			};

			const adjustedRgb = oklchToRgb(adjustedOklch);

			const clampedAdjustedRgb: RGBColor = {
				r: Math.max(0, Math.min(1, adjustedRgb.r)),
				g: Math.max(0, Math.min(1, adjustedRgb.g)),
				b: Math.max(0, Math.min(1, adjustedRgb.b)),
			};

			const currentContrast = contrast(clampedAdjustedRgb, WHITE);

			// If we're close enough to the target contrast, we're done
			if (Math.abs(currentContrast - targetContrast) < 0.1) {
				clampedRgb.r = clampedAdjustedRgb.r;
				clampedRgb.g = clampedAdjustedRgb.g;
				clampedRgb.b = clampedAdjustedRgb.b;
				break;
			}

			if (currentContrast > targetContrast) {
				// Too much contrast, need to make it lighter
				min = currentLightness;
				currentLightness = (currentLightness + max) / 2;
			} else {
				// Not enough contrast, need to make it darker
				max = currentLightness;
				currentLightness = (currentLightness + min) / 2;
			}

			iterations++;

			// If we've reached max iterations, use the closest match
			if (iterations === maxIterations) {
				const finalOklch = {
					l: currentLightness,
					c: targetC,
					h: targetH,
				};

				const finalRgb = oklchToRgb(finalOklch);
				clampedRgb.r = Math.max(0, Math.min(1, finalRgb.r));
				clampedRgb.g = Math.max(0, Math.min(1, finalRgb.g));
				clampedRgb.b = Math.max(0, Math.min(1, finalRgb.b));
			}
		}

		ramp[step] = clampedRgb;
	});

	return ramp;
}

// Function to generate a chroma curve based on user settings
function generateChromaCurve(settings: ChromaCurveSettings): number[] {
	// Steps for the color ramp
	const steps = [
		"100",
		"200",
		"300",
		"400",
		"500",
		"600",
		"700",
		"800",
		"900",
		"950",
	];
	const stepCount = steps.length;

	// Find the index of the peak position
	const peakIndex = steps.indexOf(settings.peakPosition);
	if (peakIndex === -1) return Array(stepCount).fill(1); // Fallback if peak position is invalid

	// Convert peak chroma from percentage to decimal (0-1)
	const peakValue = settings.peakChroma / 100;

	// Falloff rate factors
	const falloffFactors = {
		gentle: 0.85,
		moderate: 0.7,
		steep: 0.5,
		extreme: 0.3,
	};

	const falloffFactor =
		falloffFactors[settings.falloffRate as keyof typeof falloffFactors] ||
		falloffFactors.moderate;

	// Generate the curve
	const curve: number[] = [];

	// Minimum chroma as a percentage of peak value for lightest colors
	const minimumChromaRatio = 0.0625; // Reduced from 0.25 (75% reduction)

	for (let i = 0; i < stepCount; i++) {
		if (i === peakIndex) {
			// Peak point
			curve.push(peakValue);
		} else {
			// For both sides of the peak, use a more balanced approach
			// Calculate normalized distance from peak (-1 to 1)
			const normalizedDistance = (i - peakIndex) / (stepCount - 1);

			let value;

			if (i < peakIndex) {
				// Before peak (lighter colors)
				// Use a more gentle curve that maintains higher values

				// Special case for lightest color (100)
				if (i === 0) {
					value = peakValue * minimumChromaRatio;
				} else if (i === 1) {
					// Step 200
					// Significantly higher value for step 200
					value = peakValue * 0.5; // 50% of peak
				} else if (i === 2) {
					// Step 300
					// Higher value for step 300, getting closer to peak
					value = peakValue * 0.75; // 75% of peak
				} else {
					// For other steps before peak, gradual approach to peak
					const stepPosition = i / peakIndex; // 0 to 1
					const adjustedMixFactor = stepPosition * stepPosition; // Quadratic ramp-up

					// Mix between minimum and peak based on position
					value = peakValue * (0.8 + (1 - 0.8) * adjustedMixFactor);
				}
			} else {
				// After peak (darker colors)
				// Use exponential falloff, but with a gentler curve
				// Higher falloff factor gives a more gradual decrease
				const distance = Math.abs(normalizedDistance) * 2; // Steeper falloff for darker colors
				value = peakValue * Math.pow(falloffFactor, distance * 5);

				// Ensure darker colors drop more significantly
				if (i >= 7) {
					// 800, 900, 950
					value = value * 0.7; // Further reduce darker colors
				}
			}

			curve.push(value);
		}
	}

	return curve;
}

// Create frames with color ramp fills
function createColorRampFrames(
	seedColor: string,
	flavor: string = "bright",
	customContrastTargets?: Record<string, number>,
	chromaCurveSettings?: ChromaCurveSettings
) {
	// Generate the color ramp
	const colorRamp = generateColorRamp(
		seedColor,
		flavor,
		customContrastTargets,
		chromaCurveSettings
	);
	const rampEntries = Object.entries(colorRamp);

	// Create a parent frame to contain all color frames
	const parentFrame = figma.createFrame();

	// Update name to indicate if using custom settings
	let frameName = `[Ramp] ${
		RAMP_FLAVORS[flavor]?.name || "Color"
	} Ramp - ${seedColor}`;
	if (chromaCurveSettings) {
		frameName = `[Ramp] Custom Curve (${chromaCurveSettings.peakPosition}) - ${seedColor}`;
	}

	parentFrame.name = frameName;
	parentFrame.resize(500, 60);
	parentFrame.layoutMode = "HORIZONTAL";
	parentFrame.primaryAxisSizingMode = "FIXED";
	parentFrame.counterAxisSizingMode = "FIXED";
	parentFrame.paddingLeft = 10;
	parentFrame.paddingRight = 10;
	parentFrame.paddingTop = 10;
	parentFrame.paddingBottom = 10;
	parentFrame.itemSpacing = 5;

	// Create a frame for each color in the ramp
	rampEntries.forEach(([step, color]) => {
		const frame = figma.createFrame();
		frame.name = `${step}`;
		frame.resize(40, 40);

		// Apply the color as a fill
		const fill: SolidPaint = {
			type: "SOLID",
			color: {
				r: color.r,
				g: color.g,
				b: color.b,
			},
			opacity: 1,
		};

		frame.fills = [fill];

		// Add the frame to the parent
		parentFrame.appendChild(frame);
	});

	// Position the parent frame in the viewport
	const centerX = figma.viewport.center.x;
	const centerY = figma.viewport.center.y;
	parentFrame.x = centerX - parentFrame.width / 2;
	parentFrame.y = centerY - parentFrame.height / 2;

	// Select the parent frame
	figma.currentPage.selection = [parentFrame];
	figma.viewport.scrollAndZoomIntoView([parentFrame]);

	return parentFrame;
}

// Function to detect variables used in a node and its descendants
async function detectVariablesInNode(
	node: SceneNode
): Promise<
	Array<[string, { name: string; id: string; collectionId: string }]>
> {
	console.log(
		`Detecting variables in node: ${node.name} (${node.type}, ID: ${node.id})`
	);

	// Array to collect all variables used
	const variablesUsed: Array<
		[string, { name: string; id: string; collectionId: string }]
	> = [];

	// Check for bound variables on this node
	if (hasBoundVariables(node)) {
		console.log(`Node has boundVariables property`, node.boundVariables);

		// Check for fills with variables
		if (node.boundVariables?.fills) {
			console.log(`Found fill variables:`, node.boundVariables.fills);
			for (const [_index, binding] of Object.entries(
				node.boundVariables.fills
			)) {
				const paintVar = binding as VariableAlias;
				if (paintVar) {
					console.log(`Processing fill variable alias:`, paintVar);
					try {
						const variable = await figma.variables.getVariableByIdAsync(
							paintVar.id
						);
						if (variable) {
							console.log(`Found variable: ${variable.name} (${variable.id})`);
							variablesUsed.push([
								node.id,
								{
									name: variable.name,
									id: variable.id,
									collectionId: variable.variableCollectionId,
								},
							]);
						} else {
							console.log(`No variable found for ID: ${paintVar.id}`);
						}
					} catch (e) {
						console.error("Error getting fill variable:", e);
					}
				}
			}
		} else {
			console.log(`No fill variables found`);
		}

		// Check for strokes with variables
		if (node.boundVariables?.strokes) {
			console.log(`Found stroke variables:`, node.boundVariables.strokes);
			for (const [_index, binding] of Object.entries(
				node.boundVariables.strokes
			)) {
				const paintVar = binding as VariableAlias;
				if (paintVar) {
					console.log(`Processing stroke variable alias:`, paintVar);
					try {
						const variable = await figma.variables.getVariableByIdAsync(
							paintVar.id
						);
						if (variable) {
							console.log(`Found variable: ${variable.name} (${variable.id})`);
							variablesUsed.push([
								node.id,
								{
									name: variable.name,
									id: variable.id,
									collectionId: variable.variableCollectionId,
								},
							]);
						} else {
							console.log(`No variable found for ID: ${paintVar.id}`);
						}
					} catch (e) {
						console.error("Error getting stroke variable:", e);
					}
				}
			}
		} else {
			console.log(`No stroke variables found`);
		}

		// Add more property checks here as needed
	} else {
		console.log(`Node doesn't have boundVariables property`);
	}

	// Recursively check children if this is a container node
	if ("children" in node) {
		console.log(
			`Node has ${node.children.length} children, checking recursively`
		);
		for (const child of node.children) {
			const childVariables = await detectVariablesInNode(child);
			if (childVariables.length > 0) {
				console.log(
					`Found ${childVariables.length} variables in child ${child.name}`
				);
				variablesUsed.push(...childVariables);
			}
		}
	}

	console.log(
		`Total variables found in node ${node.name}: ${variablesUsed.length}`
	);
	return variablesUsed;
}

// Function to detect variables in the current selection
async function detectVariablesInSelection(): Promise<void> {
	const selection = figma.currentPage.selection;

	if (selection.length === 0) {
		figma.ui.postMessage({
			type: "no-selection",
			message: "Please select at least one layer to detect variables",
		});
		return;
	}

	// Process all selected nodes and their descendants
	const allVariablesUsed: Array<
		[string, { name: string; id: string; collectionId: string }]
	> = [];

	for (const node of selection) {
		const nodeVariables = await detectVariablesInNode(node);
		allVariablesUsed.push(...nodeVariables);
	}

	if (allVariablesUsed.length === 0) {
		figma.ui.postMessage({
			type: "no-variables",
			message: "No variables found in the selection",
		});
		return;
	}

	// Log the variables found
	console.log("Variables found in selection:", allVariablesUsed);

	// Format the data for display
	const variableInfo = allVariablesUsed.map(([nodeId, variable]) => {
		return {
			nodeId,
			variableName: variable.name,
			variableId: variable.id,
			variableCollectionId: variable.collectionId,
		};
	});

	// Send the data to the UI
	figma.ui.postMessage({
		type: "variables-detected",
		variables: variableInfo,
		count: allVariablesUsed.length,
	});
}

// Function to select all nodes that use a specific variable
async function selectNodesByVariable(variableId: string): Promise<void> {
	const selection = figma.currentPage.selection;

	if (selection.length === 0) {
		figma.ui.postMessage({
			type: "error",
			message: "Please select at least one layer to search within",
		});
		return;
	}

	// Get all variables used in the selection
	const allVariablesUsed = [];

	for (const node of selection) {
		const nodeVariables = await detectVariablesInNode(node);
		allVariablesUsed.push(...nodeVariables);
	}

	// Filter nodes that use the specified variable
	const matchingNodes = [];
	for (const [nodeId, variable] of allVariablesUsed) {
		if (variable.id === variableId) {
			try {
				const node = await figma.getNodeByIdAsync(nodeId);
				if (node) {
					matchingNodes.push(node as SceneNode);
				}
			} catch (e) {
				console.error(`Error getting node by ID ${nodeId}:`, e);
			}
		}
	}

	if (matchingNodes.length === 0) {
		figma.ui.postMessage({
			type: "error",
			message: "No layers found with this variable",
		});
		return;
	}

	// Update the selection to include only the matching nodes
	figma.currentPage.selection = matchingNodes;

	// Zoom to fit the selection
	figma.viewport.scrollAndZoomIntoView(matchingNodes);

	// Send confirmation to the UI
	figma.ui.postMessage({
		type: "nodes-selected",
		count: matchingNodes.length,
		message: `Selected ${matchingNodes.length} layer(s) using this variable`,
	});
}

// Function to get all color groups in the "Colors" collection
async function getColorGroups(): Promise<string[]> {
	// Get all variables
	const variables = await figma.variables.getLocalVariablesAsync();

	// Filter to just color variables
	const colorVars = variables.filter((v) => v.resolvedType === "COLOR");

	// Get all variable names
	const variableNames = colorVars.map((v) => v.name);

	// Extract group names (everything before the slash)
	const groupNames = variableNames
		.map((name) => {
			const match = name.match(/^([^/]+)\//);
			return match ? match[1] : null;
		})
		.filter(Boolean) as string[];

	// Remove duplicates and the "Gray" group
	const uniqueGroups = [...new Set(groupNames)].filter(
		(group) => group !== "Gray"
	);

	return uniqueGroups;
}

// Add a type guard function to check if a node has boundVariables
function hasBoundVariables(node: BaseNode): node is SceneNode {
	return "boundVariables" in node;
}

// Function to replace Gray variables with variables from a selected color group
async function replaceGrayVariables(
	newColorGroup: string
): Promise<{ success: number; failed: number }> {
	console.log(
		`Starting to replace Gray variables with ${newColorGroup} variables`
	);

	// Get all variables
	const variables = await figma.variables.getLocalVariablesAsync();
	console.log(`Total variables found: ${variables.length}`);

	// Get the variables for the new color group
	const newColorVars = variables.filter(
		(v) => v.resolvedType === "COLOR" && v.name.startsWith(`${newColorGroup}/`)
	);
	console.log(
		`Target color group (${newColorGroup}) variables found: ${newColorVars.length}`,
		newColorVars.map((v) => v.name)
	);

	// Check if we have enough variables in the target color group
	if (newColorVars.length === 0) {
		throw new Error(`No variables found for color group ${newColorGroup}`);
	}

	// Process nodes in the selection to find and replace Gray variables
	let successCount = 0;
	let failureCount = 0;

	// Get current selection
	const selection = figma.currentPage.selection;
	console.log(`Selection contains ${selection.length} nodes`);

	if (selection.length === 0) {
		throw new Error(
			"Please select at least one layer to search for Gray variables"
		);
	}

	// Detect all variables in the selection
	console.log("Detecting variables in selection...");
	const allVariablesUsed: Array<
		[string, { name: string; id: string; collectionId: string }]
	> = [];

	for (const node of selection) {
		const nodeVariables = await detectVariablesInNode(node);
		allVariablesUsed.push(...nodeVariables);
	}
	console.log(
		`Found ${allVariablesUsed.length} variable references in selection`
	);

	// Filter to just Gray variables
	const grayVarsUsed = allVariablesUsed.filter(([_, varInfo]) =>
		varInfo.name.startsWith("Gray/")
	);

	console.log(
		`Found ${grayVarsUsed.length} Gray variable references to replace`
	);

	// Create a map of step names to target color variables
	const targetVarsByStep = new Map<string, Variable>();
	for (const targetVar of newColorVars) {
		const step = targetVar.name.split("/")[1];
		targetVarsByStep.set(step, targetVar);
		console.log(
			`Available target variable: ${targetVar.name} for step ${step}`
		);
	}

	// Group variables by node ID for efficient processing
	const nodeMap = new Map<
		string,
		Array<{ name: string; id: string; collectionId: string }>
	>();
	for (const [nodeId, varInfo] of grayVarsUsed) {
		if (!nodeMap.has(nodeId)) {
			nodeMap.set(nodeId, []);
		}
		nodeMap.get(nodeId)?.push(varInfo);
	}
	console.log(`Variables grouped into ${nodeMap.size} nodes`);

	// Process each node
	for (const [nodeId, varInfos] of nodeMap.entries()) {
		console.log(`Processing node ${nodeId} with ${varInfos.length} variables`);
		try {
			// Get the node
			const node = await figma.getNodeByIdAsync(nodeId);
			if (!node) {
				console.log(`Node ${nodeId} not found, skipping`);
				continue;
			}
			console.log(`Node found: ${node.name} (${node.type})`);

			// Check each Gray variable on this node
			for (const varInfo of varInfos) {
				console.log(`Processing variable ${varInfo.name} (ID: ${varInfo.id})`);

				// Skip Gray/Base if requested
				if (varInfo.name === "Gray/Base") {
					console.log(`Skipping Gray/Base as requested`);
					continue;
				}

				// Get the step from Gray/XXX
				const step = varInfo.name.split("/")[1];
				console.log(`Variable step: ${step}`);

				// Find matching variable in target color group
				const targetVar = targetVarsByStep.get(step);
				if (!targetVar) {
					console.log(
						`No matching variable found for step ${step} in group ${newColorGroup}`
					);
					failureCount++;
					continue;
				}

				console.log(
					`Found replacement: ${targetVar.name} (ID: ${targetVar.id})`
				);

				// Check if the node has boundVariables
				if (!("boundVariables" in node)) {
					console.log(`Node doesn't have boundVariables property, skipping`);
					failureCount++;
					continue;
				}

				let replaced = false;

				// Handle fills
				if ("fills" in node && node.boundVariables?.fills) {
					console.log(`Checking fills for variable replacement`);

					// Clone the fills array
					const fillsCopy = JSON.parse(JSON.stringify(node.fills));
					let fillsChanged = false;

					for (const [index, binding] of Object.entries(
						node.boundVariables.fills
					)) {
						const varBinding = binding as VariableAlias;
						if (varBinding.id === varInfo.id) {
							try {
								console.log(`Replacing fill variable at index ${index}`);
								// Use setBoundVariableForPaint to modify the fill
								const idxNum = parseInt(index);
								fillsCopy[idxNum] = figma.variables.setBoundVariableForPaint(
									fillsCopy[idxNum],
									"color",
									targetVar
								);
								fillsChanged = true;
								successCount++;
								console.log(`Successfully modified fill at index ${index}`);
							} catch (e) {
								console.error(`Failed to replace fill variable:`, e);
								failureCount++;
							}
						}
					}

					// Update the fills if any changes were made
					if (fillsChanged) {
						if ("fills" in node) {
							try {
								node.fills = fillsCopy;
								replaced = true;
								console.log(`Successfully updated fills on node`);
							} catch (e) {
								console.error(`Failed to update fills on node:`, e);
								failureCount++;
							}
						}
					}
				}

				// Handle strokes
				if ("strokes" in node && node.boundVariables?.strokes) {
					console.log(`Checking strokes for variable replacement`);

					// Clone the strokes array
					const strokesCopy = JSON.parse(JSON.stringify(node.strokes));
					let strokesChanged = false;

					for (const [index, binding] of Object.entries(
						node.boundVariables.strokes
					)) {
						const varBinding = binding as VariableAlias;
						if (varBinding.id === varInfo.id) {
							try {
								console.log(`Replacing stroke variable at index ${index}`);
								// Use setBoundVariableForPaint to modify the stroke
								const idxNum = parseInt(index);
								strokesCopy[idxNum] = figma.variables.setBoundVariableForPaint(
									strokesCopy[idxNum],
									"color",
									targetVar
								);
								strokesChanged = true;
								successCount++;
								console.log(`Successfully modified stroke at index ${index}`);
							} catch (e) {
								console.error(`Failed to replace stroke variable:`, e);
								failureCount++;
							}
						}
					}

					// Update the strokes if any changes were made
					if (strokesChanged) {
						if ("strokes" in node) {
							try {
								node.strokes = strokesCopy;
								replaced = true;
								console.log(`Successfully updated strokes on node`);
							} catch (e) {
								console.error(`Failed to update strokes on node:`, e);
								failureCount++;
							}
						}
					}
				}

				// Handle text fills for text nodes
				if (!replaced && node.type === "TEXT" && node.boundVariables?.fills) {
					console.log(`Checking text fills for variable replacement`);

					// Clone the fills array for text
					const textFillsCopy = JSON.parse(JSON.stringify(node.fills));
					let textFillsChanged = false;

					for (const [index, binding] of Object.entries(
						node.boundVariables.fills
					)) {
						const varBinding = binding as VariableAlias;
						if (varBinding.id === varInfo.id) {
							try {
								console.log(`Replacing text fill variable at index ${index}`);
								const idxNum = parseInt(index);
								textFillsCopy[idxNum] =
									figma.variables.setBoundVariableForPaint(
										textFillsCopy[idxNum],
										"color",
										targetVar
									);
								textFillsChanged = true;
								successCount++;
								console.log(
									`Successfully modified text fill at index ${index}`
								);
							} catch (e) {
								console.error(`Failed to replace text fill variable:`, e);
								failureCount++;
							}
						}
					}

					// Update the text fills if any changes were made
					if (textFillsChanged) {
						try {
							node.fills = textFillsCopy;
							replaced = true;
							console.log(`Successfully updated text fills on node`);
						} catch (e) {
							console.error(`Failed to update text fills on node:`, e);
							failureCount++;
						}
					}
				}

				// If we didn't replace anything, log it
				if (!replaced) {
					console.log(
						`Couldn't find a way to replace variable ${varInfo.name} on node ${node.name}`
					);
					failureCount++;
				}
			}
		} catch (error) {
			console.error(`Error processing node ${nodeId}:`, error);
			failureCount++;
		}
	}

	console.log(
		`Replacement complete. Successes: ${successCount}, Failures: ${failureCount}`
	);
	return { success: successCount, failed: failureCount };
}

// Convert the chromaMultipliers to the format expected by the UI
function convertChromaMultipliersToStops(
	multipliers: number[]
): Record<string, number> {
	const steps = [100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
	return multipliers.reduce((acc, multiplier, index) => {
		acc[steps[index]] = multiplier;
		return acc;
	}, {} as Record<string, number>);
}

// Create preset curves object for the UI
const presetCurves = {
	default: convertChromaMultipliersToStops(
		RAMP_FLAVORS.bright.chromaMultipliers
	),
	stone: convertChromaMultipliersToStops(RAMP_FLAVORS.stone.chromaMultipliers),
	concrete: convertChromaMultipliersToStops(
		RAMP_FLAVORS.concrete.chromaMultipliers
	),
};

// Listen for messages from the UI
figma.ui.onmessage = async (msg: UiMessage) => {
	if (msg.type === "create-ramp") {
		try {
			// Create color ramp frames with specified flavor and contrast targets if in advanced mode
			createColorRampFrames(
				msg.color || "#000000",
				msg.flavor || "bright",
				msg.isAdvancedMode ? msg.customContrastTargets : undefined,
				msg.isAdvancedMode ? msg.chromaCurveSettings : undefined
			);

			// Notify UI that the ramp was created
			figma.ui.postMessage({
				type: "ramp-created",
				message: "Color ramp created successfully",
			});
		} catch (error) {
			figma.ui.postMessage({
				type: "error",
				message: "Failed to create color ramp: " + (error as Error).message,
			});
		}
	} else if (msg.type === "create-styles") {
		try {
			// Get the selected node
			const selection = figma.currentPage.selection;

			if (selection.length === 0) {
				throw new Error("No frame selected");
			}

			const node = selection[0];

			// Make sure it's a frame
			if (node.type !== "FRAME") {
				throw new Error("Selected node is not a frame");
			}

			// Extract colors from the frame
			const colors = extractColorsFromRampFrame(node as FrameNode);

			if (colors.length === 0) {
				throw new Error("No colors found in the selected frame");
			}

			// Make sure colorName is provided
			if (!msg.colorName) {
				throw new Error("Color name is required");
			}

			// Determine what to create
			const createVariables = msg.createVariables === true;
			const createStyles = msg.createStyles === true;

			// Create the color styles and/or variables
			const result = await createColorStyles(
				msg.colorName,
				colors,
				msg.organizationStyle || "nested",
				createVariables,
				createStyles
			);

			// Build success message based on what was created
			let message = "";
			if (createStyles && result.styles > 0) {
				message += `Created ${result.styles} color styles. `;
			}
			if (createVariables && result.variables > 0) {
				message += `Created ${result.variables} color variables.`;
			}

			// Notify UI that styles were created
			figma.ui.postMessage({
				type: "styles-created",
				message: message.trim() || `No styles or variables created`,
			});
		} catch (error) {
			console.error("Error creating styles:", error);
			figma.ui.postMessage({
				type: "error",
				message: "Failed to create color styles: " + (error as Error).message,
			});
		}
	} else if (msg.type === "detect-variables") {
		// Call the function to detect variables in selection
		await detectVariablesInSelection();
	} else if (msg.type === "select-by-variable") {
		// Select nodes that use a specific variable
		if (msg.variableId) {
			await selectNodesByVariable(msg.variableId);
		} else {
			figma.ui.postMessage({
				type: "error",
				message: "No variable ID provided",
			});
		}
	} else if (msg.type === "get-color-groups") {
		// Get all color groups for the dropdown
		try {
			const groups = await getColorGroups();
			figma.ui.postMessage({
				type: "color-groups",
				groups: groups,
			});
		} catch (error) {
			figma.ui.postMessage({
				type: "error",
				message: "Failed to get color groups: " + (error as Error).message,
			});
		}
	} else if (msg.type === "replace-gray-variables") {
		// Replace Gray variables with the selected color group
		if (!msg.newColorGroup) {
			figma.ui.postMessage({
				type: "error",
				message: "No color group selected",
			});
			return;
		}

		try {
			const result = await replaceGrayVariables(msg.newColorGroup);

			figma.ui.postMessage({
				type: "variables-replaced",
				success: result.success,
				failed: result.failed,
				message: `Replaced ${result.success} Gray variables with ${
					msg.newColorGroup
				} variables. ${result.failed > 0 ? `(${result.failed} failed)` : ""}`,
			});
		} catch (error) {
			figma.ui.postMessage({
				type: "error",
				message:
					"Failed to replace Gray variables: " + (error as Error).message,
			});
		}
	} else if (msg.type === "get-preset-curves") {
		figma.ui.postMessage({
			type: "preset-curves",
			curves: presetCurves,
		});
		return;
	} else if (msg.type === "close") {
		figma.closePlugin();
	}
};

// Send initial selection color when the plugin starts
sendSelectedColor();
