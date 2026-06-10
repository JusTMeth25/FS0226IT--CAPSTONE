/**
 * backend/src/routes/ai.js
 *
 * Minimal API route to perform server-side batch image generation using OpenAI.
 * POST /api/ai/generate-batch
 * Body: { items: [{ id?: string, prompt: string }], size?: '256x256'|'512x512'|'1024x1024' }
 *
 * Notes:
 * - Reads OPENAI_API_KEY from server env. For security, do not expose key to clients.
 * - Returns an array of results corresponding to input items.
 */

const express = require('express');
const openaiClient = require('../services/openaiClient');

const router = express.Router();

/**
 * POST /generate-batch
 */
router.post('/generate-batch', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const size = req.body.size;

    if (!items.length) {
      return res.status(400).json({ error: 'invalid_input', message: 'items must be a non-empty array' });
    }

    if (items.length > 20) {
      // Safety throttle for MVP
      return res.status(400).json({ error: 'too_many_items', message: 'Max 20 items per batch' });
    }

    // Optional: allow per-request API key override only if explicitly allowed via env
    const overrideKey = req.headers['x-openai-key'];
    let client = openaiClient;
    let restoreKey = null;
    if (overrideKey && process.env.ALLOW_OPENAI_KEY_OVERRIDE === 'true') {
      // create temporary client instance with override key
      const OpenAIClientClass = require('../services/openaiClient').constructor || require('../services/openaiClient').OpenAIClient;
      // Fallback: if the exported module is a singleton, create a new instance directly
      try {
        client = new (require('../services/openaiClient').constructor || require('../services/openaiClient'))(overrideKey);
      } catch (e) {
        // ignore - keep using singleton
      }
    }

    // Generate sequentially to avoid rate bursts
    const results = await client.generateBatch(items, { size });

    return res.json({ success: true, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;