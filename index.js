/**
 * ModuLink JS Library Entry Point
 * 
 * Version 2.0.0 - Function-based composition with context-driven processing.
 */

// Core functions and context creators
export * from './modulink/types.js';
export { createModulink } from './modulink/modulink.js';

// Utility functions - export both individually and as utils namespace
export * from './modulink/utils.js';
export * as utils from './modulink/utils.js';
