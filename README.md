# Color Ramp Generator Plugin for Figma

A Figma plugin that generates color ramps based on WCAG contrast ratios from a selected color.

## Features

- Detects the fill color from a selected layer
- Generates a 10-step color ramp with specific WCAG contrast ratios:
  - 100: 12
  - 200: 8
  - 300: 5.5
  - 400: 4.5
  - 500: 3
  - 600: 2.5
  - 700: 1.4
  - 800: 1.2
  - 900: 1
  - 950: 1 (slightly lighter than 900)
- Creates frames with the generated colors as fills
- Uses OKLCH color model for perceptually uniform color manipulation

## Usage

1. Select a layer with a solid fill
2. Run the plugin
3. The selected color will be displayed in the plugin UI
4. Click "Create Color Ramp" to generate a new frame with the color ramp
5. The resulting frames will be placed in the center of your current view

## Development

This plugin uses TypeScript and Webpack for building.

### Setup

```bash
npm install
```

### Development build with watch mode

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## How It Works

The plugin uses a binary search algorithm to find precise colors that match specific WCAG contrast ratios against white. The color ramp is generated in OKLCH color space, which maintains consistent perceptual lightness across different hues.

Below are the steps to get your plugin running. You can also find instructions at:

https://www.figma.com/plugin-docs/plugin-quickstart-guide/

This plugin template uses Typescript and NPM, two standard tools in creating JavaScript applications.

First, download Node.js which comes with NPM. This will allow you to install TypeScript and other
libraries. You can find the download link here:

https://nodejs.org/en/download/

Next, install TypeScript using the command:

npm install -g typescript

Finally, in the directory of your plugin, get the latest type definitions for the plugin API by running:

npm install --save-dev @figma/plugin-typings

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code
is already valid Typescript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code
to provide information about the Figma API while you are writing code, as well as help catch bugs
you previously didn't notice.

For more information, visit https://www.typescriptlang.org/

Using TypeScript requires a compiler to convert TypeScript (code.ts) into JavaScript (code.js)
for the browser to run.

We recommend writing TypeScript code using Visual Studio code:

1. Download Visual Studio Code if you haven't already: https://code.visualstudio.com/.
2. Open this directory in Visual Studio Code.
3. Compile TypeScript to JavaScript: Run the "Terminal > Run Build Task..." menu item,
   then select "npm: watch". You will have to do this again every time
   you reopen Visual Studio Code.

That's it! Visual Studio Code will regenerate the JavaScript file every time you save.
