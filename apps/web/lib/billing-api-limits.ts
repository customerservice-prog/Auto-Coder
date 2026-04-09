/** Checkout POST JSON (`{ plan?, priceId? }`); streaming cap before auth when read first in handler. */
export const STRIPE_CHECKOUT_POST_MAX_BYTES = 16 * 1024;

/** Portal POST has no body; small cap drains junk payloads cheaply. */
export const STRIPE_PORTAL_POST_MAX_BYTES = 4096;

/** Stripe Price id strings are short; bound avoids abuse via huge strings. */
export const STRIPE_PRICE_ID_MAX_CHARS = 256;
