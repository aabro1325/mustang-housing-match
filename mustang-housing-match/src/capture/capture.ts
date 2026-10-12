// Injected into the active tab with chrome.scripting.executeScript({ files: ["capture.js"] }).
// Must stay self-contained (no chrome.* APIs, no imports that touch the DOM lazily).
// The completion value is what the side panel receives. Build 4 replaces the body with the per-Source readers.
import { capturePage } from "./readers/index";

(globalThis as unknown as { __mhmCapture: unknown }).__mhmCapture = capturePage(document, location.href);
