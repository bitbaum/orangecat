// Import first in a brand script: `import './lib/register-ts.mjs';`
// See ./ts-hooks.mjs for what it resolves and why.
import { register } from 'node:module';

register('./ts-hooks.mjs', import.meta.url);
