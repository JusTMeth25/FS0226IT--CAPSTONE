/**
 * VinylDex - AI Service
 * Handles OpenAI API calls for card artwork generation.
 * Uses DALL-E for image generation.
 */
class AIService {
  constructor() {
    /** @type {string} */
    this.apiKey = '';

    /** @type {string} */
    this.baseUrl = 'https://api.openai.com/v1';

    /** @type {Map<string, string>} Cache of generated images (prompt -> dataUrl) */
    this.imageCache = new Map();

    /** @type {number} Max cache size */
    this.maxCacheSize = 50;
  }

  /**
   * Set the API key.
   * @param {string} key
   */
  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Check if API key is set.
   * @returns {boolean}
   */
  hasApiKey() {
    return this.apiKey.length > 10;
  }

  /**
   * Generate image for a card using DALL-E.
   * @param {Object} card - Card data with name, artistClass, rarity, stats
   * @param {Object} options - Generation options
   * @param {string} options.style - Art style (e.g., 'anime', 'realistic', 'cyberpunk')
   * @param {string} options.size - Image size ('256x256', '512x512', '1024x1024')
   * @returns {Promise<Object>} { url, revisedPrompt }
   */
  async generateCardArtwork(card, options = {}) {
    const style = options.style || 'anime';
    const size = options.size || '512x512';

    const prompt = this._buildCardPrompt(card, style);

    // Check cache first
    const cacheKey = `${card.id}_${style}`;
    if (this.imageCache.has(cacheKey)) {
      const cached = this.imageCache.get(cacheKey);
      return { url: cached.url, revisedPrompt: cached.revisedPrompt, cached: true };
    }

    if (!this.hasApiKey()) {
      throw new Error('API key non impostata. Configurala dalle impostazioni.');
    }

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: size,
        quality: 'standard',
        response_format: 'b64_json'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const b64 = data.data[0].b64_json;
    const dataUrl = `data:image/png;base64,${b64}`;

    // Cache the result
    if (this.imageCache.size >= this.maxCacheSize) {
      const firstKey = this.imageCache.keys().next().value;
      this.imageCache.delete(firstKey);
    }
    this.imageCache.set(cacheKey, { url: dataUrl, revisedPrompt: data.data[0].revised_prompt });

    return { url: dataUrl, revisedPrompt: data.data[0].revised_prompt, cached: false };
  }

  /**
   * Generate a batch of card artworks.
   * @param {Array<Object>} cards - Array of card data
   * @param {Object} options
   * @param {Function} onProgress - Callback (index, total)
   * @returns {Promise<Array>}
   */
  async generateBatch(cards, options = {}, onProgress = null) {
    const results = [];
    for (let i = 0; i < cards.length; i++) {
      try {
        const result = await this.generateCardArtwork(cards[i], options);
        results.push({ card: cards[i], ...result, success: true });
      } catch (error) {
        results.push({ card: cards[i], error: error.message, success: false });
      }
      if (onProgress) onProgress(i + 1, cards.length);
    }
    return results;
  }

  /**
   * Build a detailed prompt for a card.
   * @param {Object} card
   * @param {string} style
   * @returns {string}
   */
  _buildCardPrompt(card, style) {
    const classThemes = {
      'The Showman': 'stage performer, spotlight, dramatic pose, showmanship, confidence',
      'The Rebel': 'rebel spirit, leather, electric guitar, punk rock, attitude',
      'The Virtuoso': 'classical virtuoso, violin, elegant, refined, technical mastery',
      'The Innovator': 'futuristic, cyberpunk, digital, synthesizer, neon lights',
      'The Poet': 'poetic, emotional, microphone, stage, emotional expression',
      'The King of Riffs': 'powerful guitarist, electric guitar, rock, energy, intensity',
      'The Dreamer': 'ethereal, dreamy, floating, celestial, peaceful, imaginative',
      'The Synth Master': 'cyberpunk, synthesizer, electronic, digital, futuristic'
    };

    const rarityVibe = {
      common: 'basic, simple, grounded',
      uncommon: 'refined, polished, skilled',
      rare: 'powerful, intense, notable',
      epic: 'legendary-tier, epic, glowing energy',
      legendary: 'supreme, divine, glowing, legendary aura, epic pose'
    };

    const theme = classThemes[card.artistClass] || 'musician, stage';
    const rarity = rarityVibe[card.rarity] || 'powerful';
    const styleTag = style === 'anime' ? 'anime style, manga inspired, vibrant colors, dramatic lighting' :
                     style === 'realistic' ? 'photorealistic, detailed, cinematic lighting' :
                     style === 'cyberpunk' ? 'cyberpunk neon, futuristic, holographic, digital glow' :
                     'digital art, vibrant, dynamic';

    return `${styleTag}, ${card.name} from VinylDex universe, ${card.artistClass}, ${theme}, ${rarity}, vinyl record aesthetic, musical themed background, character portrait, high detail, masterpiece quality`;
  }
}

// Singleton
window.VinylDexAI = new AIService();