/*!
 * ftc-embeds avatar maker core: turns a team's logo into FIRST's 40 × 40 PNG avatars. Pure functions,
 * no DOM. Not part of the npm package. License: MIT
 */
export { AVATAR_SIZE, WORK_SCALE, WORK_SIZE, sourceFromRGBA, subjectBox, resolveSampling, resolveTransparent, fitFor, zoomFit, orientFit, quantizeColors, render } from "./render.mjs";
export { runChecks, applyFix, contentBox, chromaKeyOf, MAX_BYTES } from "./checks.mjs";
export { PROJECT_FORMAT, PROJECT_VERSION, LIMITS, wholeFit, defaultVariant, newProject, nextId, projectToFile, validateProject } from "./project.mjs";
export { encodePNG, decodePNG, deflateStored, crc32 } from "./png.mjs";
export { makeZip } from "./zip.mjs";
export { clamp01, srgbToLinear, linearToSrgb, linearToOklab, oklabToLinear, srgbToOklab, oklabToSrgb, oklabToOklch, oklchToOklab, deltaE, rgbToHsv, hsvToRgb, parseHex, formatHex, relativeLuminance, contrastRatio, colorToAlpha } from "./color.mjs";
export { createRaster, rasterFromRGBA8, rasterToImage8, cloneRaster, compositeOver, fillOver, multiplyCoverage, lanczos3, resampleWeights, rowsFromRGBA8, rowsFromRaster, resampleRows, halveRows, boxReduce, boxReduceChannel, orientRGBA, distanceTransform, floodFill, labelComponents, mulberry32 } from "./raster.mjs";
