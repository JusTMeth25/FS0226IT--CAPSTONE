/**
 * Language: JavaScript (CommonJS)
 * backend/src/services/openaiClient.js
 *
 * Purpose:
 * - Server-side OpenAI image generation client.
 * - Provides generateImage(prompt, size) and generateBatch(prompts, options) methods.
 * - Keeps implementation small, testable, and easily mockable.
 *
 * Usage:
 * const openai = require('../services/openaiClient');
 * const result = await openai.generateImage("prompt text", "512x512");
 *
 * Notes:
 * - Reads API key from process.env.OPENAI_API_KEY by default.
 * - Uses global fetch available in Node >=18.
 * - Returns base64 data URLs so frontend can display immediately without extra storage.
 */

const DEFAULT_BASE = 'https://api.openai.com/v1';

class OpenAIClient {
  /**
   * @param {string} apiKey Optional override for API key (defaults to process.env.OPENAI_API_KEY)
   * @param {string} baseUrl Optional base URL for the OpenAI API
   */
  constructor(apiKey, baseUrl = DEFAULT_BASE) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = baseUrl;
    // Simple concurrency control / safety: limit number of parallel requests if needed
    this.defaultSize = '512x512';
  }

  hasKey() {
    return typeof this.apiKey === 'string' && this.apiKey.length > 10;
  }

  /**
   * Generate a single image using DALL-E style endpoint.
   * @param {string} prompt
   * @param {Object} opts
   * @param {string} opts.size ('256x256'|'512x512'|'1024x1024')
   * @returns {Promise<{ dataUrl: string, revisedPrompt?: string }>}
   */
  async generateImage(prompt, opts = {}) {
    const size = opts.size || this.defaultSize;

    if (!this.hasKey()) {
      throw new Error('OpenAI API key not configured on server (OPENAI_API_KEY).');
    }

    const payload = {
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: size,
      response_format: 'b64_json'
    };

    const res = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      // Attempt to surface helpful error information
      let details = '';
      try {
        const json = await res.json();
        details = json.error?.message || JSON.stringify(json);
      } catch (e) {
        details = await res.text().catch(() => `status ${res.status}`);
      }
      throw new Error(`OpenAI image generation failed: ${details}`);
    }

    const json = await res.json();
    const entry = (json.data && json.data[0]) || null;
    if (!entry || !entry.b64_json) {
      throw new Error('OpenAI response malformed: missing b64_json.');
    }

    const b64 = entry.b64_json;
    const dataUrl = `data:image/png;base64,${b64}`;
    return { dataUrl, revisedPrompt: entry.revised_prompt || null };
  }

  /**
   * Generate images for an array of prompts (sequential to avoid burst-rate issues).
   * Returns an array of { success, dataUrl?, error? } in same order as prompts.
   * @param {Array<{ id?: string, prompt: string }>} items
   * @param {Object} options
   * @param {string} options.size
   * @param {Function} options.onProgress (index, total) optional
   * @returns {Promise<Array>}
   */
  async generateBatch(items = [], options = {}) {
    const size = options.size || this.defaultSize;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        const { dataUrl, revisedPrompt } = await this.generateImage(it.prompt, { size });
        results.push({ id: it.id || null, success: true, dataUrl, revisedPrompt });
      } catch (err) {
        results.push({ id: it.id || null, success: false, error: String(err) });
      }
      if (onProgress) {
        try { onProgress(i + 1, items.length); } catch (e) { /* swallow progress errors */ }
      }
    }
    return results;
  }
}

// Export singleton instance for simplicity in this MVP backend
module.exports = new OpenAIClient();