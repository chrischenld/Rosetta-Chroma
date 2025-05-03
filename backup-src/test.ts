import { generateColorRamp } from "./utils/colorRamp";

// Example usage with different seed colors
const colors = [
	"#0066FF", // Blue
	"#00AA00", // Green
	"#FF0000", // Red
	"#AA00AA", // Purple
];

// Generate color ramps for each seed color
colors.forEach((color) => {
	console.log(`\nColor ramp for ${color}:`);
	const ramp = generateColorRamp(color);

	// Print each color in the ramp
	Object.entries(ramp).forEach(([step, value]) => {
		console.log(`${step}: ${value}`);
	});
});

// Example of how to use in a Figma plugin
/*
figma.showUI(__html__);

figma.ui.onmessage = msg => {
  if (msg.type === 'generate-ramp') {
    const seedColor = msg.color; // Hex color from UI
    const ramp = generateColorRamp(seedColor);
    
    // Send generated ramp back to UI
    figma.ui.postMessage({
      type: 'ramp-generated',
      ramp
    });
  }
};
*/
