// End to end in a headless browser against the stub server:
//   node tools/book/stub-server.mjs 8787 &  node tools/book/e2e.mjs
// Walks the real page through every step the way a person would,
// then checks what the page sent the server: Standard (sign-up, add a
// home, pick a pro), Express with a card missing (the card step appears
// and the job carries the shown fee), NOW, the error paths, photos
// (shrunk, one per request), and the server's web settings missing.
//
// The runs live in tools/book/e2e/ (booking.mjs: runs 1–5, extras.mjs:
// runs 6–8, lib.mjs: the shared browser and steps); they run in that order.

// One after the other: sibling modules with top-level await would run
// at the same time against the one stub.
const { browser } = await import('./e2e/lib.mjs');
await import('./e2e/booking.mjs');
await import('./e2e/extras.mjs');

await browser.close();
console.log('all e2e runs passed');
