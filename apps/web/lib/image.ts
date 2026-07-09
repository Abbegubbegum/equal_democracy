import sharp from "sharp";

/**
 * Re-encode an uploaded image to a size-capped JPEG so raw phone photos never
 * land in Blob storage untouched (the admin upload routes previously stored the
 * original buffer, producing multi-MB blobs). Auto-orients via EXIF, downscales
 * so the long edge is at most 1600px (never upscales), strips metadata, and
 * re-encodes at quality 75.
 *
 * Always returns JPEG bytes — callers must store the result with a `.jpg`
 * pathname and `image/jpeg` content type regardless of the input format.
 */
export async function compressImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // apply EXIF orientation before metadata is dropped
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toBuffer();
}
