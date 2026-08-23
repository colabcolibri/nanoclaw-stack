// Channel self-registration barrel.
// Each channel lives under channels/<name>/ and is imported here.
//
// Shared infrastructure (adapter, registry, chat-sdk-bridge) stays at channels/.
// Main ships with cli + telegram; other channels append an import below.

import './cli/index.js';
import './telegram/index.js';
