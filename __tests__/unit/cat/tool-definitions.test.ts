import { describe, expect, it } from 'vitest';
import { PLATFORM_TOOL_DEFINITION } from '@/services/cat/tool-use-detection';
import { actionToolDefinitions } from '@/services/cat/action-schemas';
import { uniqueToolDefinitions } from '@/services/cat/tool-definitions';

describe('Cat tool declarations', () => {
  it('offers each function name once to providers that reject duplicates', () => {
    const platform = PLATFORM_TOOL_DEFINITION;
    const combined = uniqueToolDefinitions([...platform, ...actionToolDefinitions()]);
    const names = combined.map(tool => tool.function.name);

    expect(names).toHaveLength(new Set(names).size);
    expect(combined.find(tool => tool.function.name === 'forget_memories')).toBe(
      platform.find(tool => tool.function.name === 'forget_memories')
    );
    expect(names).toContain('prefill_entity_form');
  });
});
