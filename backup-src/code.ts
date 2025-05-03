import { generateColorRamp } from "./utils/colorRamp";
import * as culoriLib from "culori";

// Initialize the plugin
figma.showUI(__html__, { width: 300, height: 350 });

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

			// Send color to UI
			figma.ui.postMessage({
				type: "selected-color",
				color: hex,
				opacity: solidFill.opacity || 1,
			});
		} else {
			figma.ui.postMessage({
				type: "no-fill",
				message: "Selected layer has no solid fill",
			});
		}
	} else {
		figma.ui.postMessage({
			type: "no-fill",
			message: "Selected layer has no fill property",
		});
	}
}

// Convert RGB values (0-1) to hex string
function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (value: number) => {
		const hex = Math.round(value * 255).toString(16);
		return hex.length === 1 ? "0" + hex : hex;
	};

	return "#" + toHex(r) + toHex(g) + toHex(b);
}

// Create frames with color ramp fills
function createColorRampFrames(seedColor: string) {
	// Generate the color ramp
	const colorRamp = generateColorRamp(seedColor);
	const rampEntries = Object.entries(colorRamp);

	// Create a parent frame to contain all color frames
	const parentFrame = figma.createFrame();
	parentFrame.name = `Color Ramp - ${seedColor}`;
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
	rampEntries.forEach(([step, colorValue]) => {
		const frame = figma.createFrame();
		frame.name = `${step}`;
		frame.resize(40, 40);

		// Parse the OKLCH color and convert to RGB for Figma
		const color = culoriLib.rgb(colorValue);
		if (color) {
			const fill: SolidPaint = {
				type: "SOLID",
				color: {
					r: color.r,
					g: color.g,
					b: color.b,
				},
				opacity: color.alpha !== undefined ? color.alpha : 1,
			};

			frame.fills = [fill];
		}

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

// Listen for messages from the UI
figma.ui.onmessage = (msg) => {
	if (msg.type === "get-selected-color") {
		sendSelectedColor();
	} else if (msg.type === "create-ramp") {
		try {
			// Create color ramp frames
			createColorRampFrames(msg.color);

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
	} else if (msg.type === "close") {
		figma.closePlugin();
	}
};

// Send initial selection color when the plugin starts
sendSelectedColor();
