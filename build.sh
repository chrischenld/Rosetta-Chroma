#!/bin/bash

echo "Building Color Ramp Generator Plugin..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build the plugin
echo "Building production version..."
npm run build

# Create dist directory if it doesn't exist
mkdir -p dist

echo "Done! Plugin built successfully."
echo "The plugin files are in the 'dist' directory." 