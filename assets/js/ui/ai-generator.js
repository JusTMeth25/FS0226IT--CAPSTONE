/**
 * VinylDex - AI Generator UI
 * Gallery and generation interface for card artwork.
 */
const VinylDexAIGenerator = {
  /** Current selected card */
  _selectedCard: null,

  /** Current style selection */
  _selectedStyle: 'anime',

  /** Generated images history */
  _history: [],

  /** Available styles */
  STYLES: [
    { id: 'anime', name: 'Anime', desc: 'Manga inspired, vibrant, dramatic' },
    { id: 'realistic', name: 'Realistico', desc: 'Photorealistic, cinematic' },
    { id: 'cyberpunk', name: 'Cyberpunk', desc: 'Neon, futuristic, holographic' }
  ],

  render(container, params) {
    const apiKey = window.VinylDexAI.hasApiKey();
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    const generatedImages = storage.get('generatedImages', []);

    container.innerHTML = `
      <section class="ai-page">
        <h2 class="section-title text-gradient">🤖 Generatore AI</h2>
        <p class="text-center" style="color:var(--text-secondary);">Genera artwork uniche per le tue carte usando DALL-E</p>

        <!-- API Key Section -->
        <div class="glass-panel ai-settings">
          <h3>⚙️ Configurazione API</h3>
          <div class="ai-key-row">
            <input type="password" id="ai-api-key" class="ai-input"
                   placeholder="Inserisci la tua OpenAI API key..."
                   value="${apiKey ? '••••••••' : ''}">
            <button class="btn btn-primary btn-small" onclick="VinylDexAIGenerator.saveApiKey()">
              Salva
            </button>
            <span class="ai-key-status ${apiKey ? 'ai-key-ok' : 'ai-key-missing'}">
              ${apiKey ? '✅ Configurata' : '❌ Non configurata'}
            </span>
          </div>
          <p class="ai-help-text">La API key viene salvata solo localmente nel tuo browser (localStorage).</p>
        </div>

        <!-- Card Selection -->
        <div class="glass-panel ai-card-select">
          <h3>🃏 Seleziona una Carta</h3>
          ${collection.length > 0 ? `
            <div class="ai-cards-list">
              ${this._getUniqueCards(collection).map(card => {
                const isSelected = this._selectedCard && this._selectedCard.id === card.id;
                return `
                  <div class="ai-card-option ${isSelected ? 'ai-card-selected' : ''}"
                       onclick="VinylDexAIGenerator.selectCard('${card.id}')">
                    <div class="ai-card-option-preview">
                      <img src="${card.img}" alt="${card.name}" onerror="this.parentElement.innerHTML='<span style=\\'font-size:1.5rem\\'>🎵</span>'">
                    </div>
                    <div class="ai-card-option-info">
                      <span class="ai-card-option-name">${card.name}</span>
                      <span class="ai-card-option-class">${card.artistClass}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div class="empty-state" style="padding:1rem;">
              <p>Nessuna carta in collezione.</p>
              <a href="#packs" class="btn btn-secondary btn-small">Apri Pacchetti</a>
            </div>
          `}
        </div>

        <!-- Style Selection -->
        <div class="glass-panel ai-style-select">
          <h3>🎨 Stile Artistico</h3>
          <div class="ai-styles-grid">
            ${this.STYLES.map(s => `
              <div class="ai-style-card ${this._selectedStyle === s.id ? 'ai-style-selected' : ''}"
                   onclick="VinylDexAIGenerator.selectStyle('${s.id}')">
                <span class="ai-style-name">${s.name}</span>
                <span class="ai-style-desc">${s.desc}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Generate Button -->
        <button class="btn btn-primary btn-large ai-generate-btn"
                onclick="VinylDexAIGenerator.generate()"
                ${!apiKey ? 'disabled title="Configura prima la API key"' : ''}>
          ${apiKey ? '✨ Genera Artwork' : '⚠️ Configura API Key prima'}
        </button>

        <!-- Loading -->
        <div id="ai-loading" style="display:none;" class="text-center">
          <div class="ai-loading-spinner"></div>
          <p style="color:var(--neon-cyan);">Generazione in corso... DALL-E sta lavorando</p>
        </div>

        <!-- Generated Images Gallery -->
        ${generatedImages.length > 0 ? `
          <div class="glass-panel ai-gallery">
            <h3>🖼️ Galleria Generata (${generatedImages.length})</h3>
            <div class="ai-gallery-grid">
              ${generatedImages.reverse().map((img, i) => `
                <div class="ai-gallery-item">
                  <img src="${img.url}" alt="${img.cardName}">
                  <div class="ai-gallery-info">
                    <span>${img.cardName}</span>
                    <span class="ai-gallery-style">${img.style}</span>
                  </div>
                  <button class="btn btn-secondary btn-small" 
                          onclick="VinylDexAIGenerator.applyToCard('${img.cardId}', ${i})">
                    Applica
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </section>
    `;
  },

  _getUniqueCards(collection) {
    const seen = new Set();
    return collection.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).sort((a, b) => (b.obtainedAt || 0) - (a.obtainedAt || 0));
  },

  saveApiKey() {
    const input = document.getElementById('ai-api-key');
    if (input && input.value && input.value !== '••••••••') {
      window.VinylDexAI.setApiKey(input.value);
      localStorage.setItem('vinylDex_aiKey', input.value);
      this._reRender();
    }
  },

  selectCard(cardId) {
    const storage = new window.VinylDexStorage();
    const collection = storage.getCollection();
    this._selectedCard = collection.find(c => c.id === cardId) || null;
    this._reRender();
  },

  selectStyle(styleId) {
    this._selectedStyle = styleId;
    this._reRender();
  },

  async generate() {
    if (!this._selectedCard) {
      alert('Seleziona prima una carta!');
      return;
    }
    if (!window.VinylDexAI.hasApiKey()) {
      alert('Configura prima la API key!');
      return;
    }

    const loading = document.getElementById('ai-loading');
    const btn = document.querySelector('.ai-generate-btn');
    if (loading) loading.style.display = 'block';
    if (btn) btn.disabled = true;

    try {
      const result = await window.VinylDexAI.generateCardArtwork(
        this._selectedCard,
        { style: this._selectedStyle, size: '512x512' }
      );

      // Save to storage
      const storage = new window.VinylDexStorage();
      const images = storage.get('generatedImages', []);
      images.unshift({
        url: result.url,
        cardId: this._selectedCard.id,
        cardName: this._selectedCard.name,
        artistClass: this._selectedCard.artistClass,
        style: this._selectedStyle,
        prompt: result.revisedPrompt,
        timestamp: Date.now()
      });

      // Keep only last 50
      if (images.length > 50) images.splice(50);
      storage.set('generatedImages', images);

      this._reRender();
    } catch (error) {
      alert('Errore durante la generazione: ' + error.message);
    } finally {
      if (loading) loading.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  },

  applyToCard(cardId, imageIndex) {
    const storage = new window.VinylDexStorage();
    const images = storage.get('generatedImages', []);
    const img = images[imageIndex];
    if (!img) return;

    // Update the card in collection
    const collection = storage.getCollection();
    const cardIndex = collection.findIndex(c => c.id === cardId);
    if (cardIndex >= 0) {
      collection[cardIndex].img = img.url;
      storage.setCollection(collection);
    }

    alert(`✅ Immagine applicata a ${img.cardName}!`);
    this._reRender();
  },

  _reRender() {
    const container = document.getElementById('app-view');
    if (container) {
      this.render(container, {});
    }
  },

  destroy() {}
};

// Load saved API key on init
if (localStorage.getItem('vinylDex_aiKey')) {
  window.VinylDexAI.setApiKey(localStorage.getItem('vinylDex_aiKey'));
}

window.VinylDexAIGenerator = VinylDexAIGenerator;