#!/bin/bash
set -e

# Install root dependencies (bot)
npm install --legacy-peer-deps

# Install dashboard dependencies
cd dashboard && npm install --legacy-peer-deps
