import "server-only";

/**
 * Prompt rules adapted from Decart's official try-on examples (MIT License,
 * https://github.com/DecartAI/tryon-examples): Substitute/Add pattern, 20–30 words,
 * describe only what is clearly visible. Here the classification, the supported-item
 * check, the "is there a person in the product photo" check and the prompt are merged
 * into ONE vision call to save a round trip.
 */

export const SUPPORTED_ITEMS = [
  "mask", "sunglasses", "jacket", "cap", "gloves", "hat", "shirt", "eyeglasses",
  "t-shirt", "sweatshirt", "beanie", "glove", "dress", "goggles", "helmet",
  "sweater", "glasses", "scarf", "shorts", "jersey", "coat", "socks", "top",
  "tiara", "vest", "mittens", "cardigan", "blouse", "veil", "skirt",
  "pants", "shoes", "hoodie",
] as const;

export const CATEGORIES = ["top", "outerwear", "bottom", "full_body", "accessory", "unsupported"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PREPARE_SYSTEM_PROMPT = `You prepare inputs for a real-time virtual try-on video model.
You receive (1) a reference image that should show ONE clothing item, and optionally (2) a camera frame of the person who will try it on.

Return ONLY a JSON object with these keys:
{
  "item": short noun for the garment, e.g. "denim jacket",
  "category": one of "top" | "outerwear" | "bottom" | "full_body" | "accessory" | "unsupported",
  "supported": boolean,
  "reference_has_person": boolean,
  "multiple_items": boolean,
  "prompt": string
}

Rules:
1. supported: true only if the item is (a close variant of) one of: ${SUPPORTED_ITEMS.join(", ")}.
   Bags, belts, watches, jewelry, necklaces, bracelets, rings, earrings and jumpsuits are NOT supported -> category "unsupported".
2. category: tops = shirt, t-shirt, sweater, sweatshirt, hoodie, blouse, jersey, top; outerwear = jacket, coat, vest, cardigan;
   bottom = pants, shorts, skirt, shoes, socks; full_body = dress; accessory = hat, cap, beanie, scarf, glasses, sunglasses, mask, gloves, helmet, goggles, tiara, veil, mittens.
3. reference_has_person: true if a human (or a visible body part wearing the item) appears in the reference image.
4. multiple_items: true if the reference shows a whole outfit or several products, so the target is ambiguous.
5. prompt (20-30 words, English):
   - Look at the camera frame (if given) and identify what the person currently wears in the same body slot.
   - If they already wear something in that slot use: "Substitute the <current garment> with <reference garment description>".
   - If the slot is empty (no hat, no jacket over the shirt...) use: "Add <reference garment description> to the person's <body part>".
   - If no camera frame is given or the slot is not visible, say "the current top" / "the current bottoms".
   - Describe color, material, texture, pattern and fit. ONLY describe features you can clearly see; never invent zippers,
     pockets, logos, buttons or accessories. If the material is unclear use a general word (knit, woven, fabric).
   - Never mention the model, mannequin, background or any accessory the reference person wears.
No markdown, no explanations, JSON only.`;

export const EXTRACT_GARMENT_PROMPT =
  "Extract only the clothing garment from this image. Remove the person, body, skin, hair, accessories and background completely. " +
  "Show only the isolated clothing item, front view, on a plain white background. Keep the exact colors, patterns and details of the garment.";

export function fallbackPrompt(category: Category | undefined): string {
  switch (category) {
    case "bottom":
      return "Substitute the current bottoms with the garment shown in the reference image, matching its exact color, pattern and fit";
    case "full_body":
      return "Substitute the current outfit with the dress shown in the reference image, matching its exact color, pattern and length";
    case "accessory":
      return "Add the accessory shown in the reference image to the person, matching its exact color, shape and material";
    case "outerwear":
      return "Add the outerwear shown in the reference image over the person's current top, matching its exact color, material and fit";
    default:
      return "Substitute the current top with the garment shown in the reference image, matching its exact color, pattern, material and fit";
  }
}
