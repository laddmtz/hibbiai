// Use dynamic import for better browser compatibility
const loadHuggingFace = async () => {
    const { HfInference } = await import('https://cdn.jsdelivr.net/npm/@huggingface/inference@2.8.0/+esm');
    return new HfInference('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');
};

class AIImageGenerator {
    constructor() {
        this.hf = null;
        this.initializeElements();
        this.bindEvents();
        this.gallery = [];
        this.currentSeed = null;
        this.lastPrompt = '';
        this.lastImageUrl = '';
        this.lastBlob = null;
    }

    async initHuggingFace() {
        try {
            this.hf = await loadHuggingFace();
            console.log('Hugging Face client initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Hugging Face:', error);
            this.showError('Failed to connect to AI service. Please refresh the page.');
        }
    }

    initializeElements() {
        this.promptInput = document.getElementById('prompt');
        this.styleSelect = document.getElementById('style');
        this.aspectSelect = document.getElementById('aspect');
        this.transparentCheckbox = document.getElementById('transparent');
        this.generateBtn = document.getElementById('generateBtn');
        this.placeholderArea = document.getElementById('placeholderArea');
        this.imageArea = document.getElementById('imageArea');
        this.generatedImage = document.getElementById('generatedImage');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.regenerateBtn = document.getElementById('regenerateBtn');
        this.galleryContainer = document.getElementById('gallery');
        this.variationsBtn = document.getElementById('variationsBtn');
    }

    bindEvents() {
        this.generateBtn.addEventListener('click', () => this.generateImage());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.regenerateBtn.addEventListener('click', () => this.generateImage(null, true)); // Pass regenerate flag
        this.variationsBtn.addEventListener('click', () => this.generateVariation());
        
        // Enable Enter key to generate
        this.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.generateImage();
            }
        });
        
        // Auto-resize textarea
        this.promptInput.addEventListener('input', () => {
            this.promptInput.style.height = 'auto';
            this.promptInput.style.height = this.promptInput.scrollHeight + 'px';
        });
    }

    async generateImage(seed = null, regenerate = false) {
        let prompt = this.promptInput.value.trim();
        
        if (!prompt) {
            this.showError('Please enter a prompt to generate an image');
            return;
        }

        this.setLoading(true);
        
        try {
            const style = this.styleSelect.value;
            let fullPrompt = await this.enhancePrompt(prompt, style);
            
            if (regenerate) {
                fullPrompt = this.lastEnhancedPrompt || fullPrompt;
            } else {
                this.lastEnhancedPrompt = fullPrompt;
            }

            const aspectRatio = this.aspectSelect.value;
            const transparent = this.transparentCheckbox.checked;

            const generationSeed = seed !== null ? seed : Math.floor(Math.random() * 1000000);
            this.currentSeed = generationSeed;
            
            const result = await websim.imageGen({
                prompt: fullPrompt,
                aspect_ratio: aspectRatio,
                transparent: transparent,
                seed: generationSeed,
            });
            
            const imageUrl = result.url;
            
            // To enable download, we need to fetch the image as a blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            this.displayImage(blobUrl, prompt, blob);
            this.addToGallery(blobUrl, prompt);
            
            this.variationsBtn.style.display = 'block';
            
        } catch (error) {
            console.error('Error generating image:', error);
            this.showError('Failed to generate image. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }
    
    async enhancePrompt(prompt, style) {
        try {
            const completion = await websim.chat.completions.create({
                messages: [{
                    role: 'system',
                    content: `You are a creative assistant that expands a user's prompt into a more detailed and vivid description for an AI image generator. 
                    - Incorporate the requested style.
                    - Add details about lighting, composition, and mood.
                    - Keep it concise, under 70 words.
                    - Respond with only the enhanced prompt, no extra text.`
                }, {
                    role: 'user',
                    content: `Prompt: "${prompt}", Style: ${style}`
                }]
            });
            return completion.content;
        } catch (e) {
            console.warn("Prompt enhancement failed, using original prompt.", e);
            return `${prompt}, ${style}`;
        }
    }

    async generateVariation() {
        if (!this.lastEnhancedPrompt) return;
        // Generate a new seed for a variation
        const variationSeed = Math.floor(Math.random() * 1000000);
        await this.generateImage(variationSeed);
    }

    displayImage(imageUrl, prompt, blob) {
        this.generatedImage.src = imageUrl;
        this.generatedImage.alt = `AI generated: ${prompt}`;
        this.lastPrompt = prompt;
        this.lastImageUrl = imageUrl;
        this.lastBlob = blob;
        
        this.placeholderArea.style.display = 'none';
        this.imageArea.style.display = 'block';
    }

    async downloadImage() {
        if (!this.lastBlob) {
            this.showError("No image to download.");
            return;
        }
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(this.lastBlob);
        
        const safePrompt = this.lastPrompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const extension = this.lastBlob.type.split('/')[1] || 'png';
        link.download = `hibii-${safePrompt}-${Date.now()}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    addToGallery(imageUrl, prompt) {
        const galleryItem = {
            url: imageUrl,
            prompt: prompt,
            timestamp: Date.now(),
            blobUrl: imageUrl // Store blob url for redisplay
        };
        
        this.gallery.unshift(galleryItem);
        
        if (this.gallery.length > 12) {
             const oldestItem = this.gallery.pop();
             // Clean up old blob urls to prevent memory leaks
             URL.revokeObjectURL(oldestItem.blobUrl);
        }
        
        this.renderGallery();
    }

    renderGallery() {
        this.galleryContainer.innerHTML = '';
        
        this.gallery.forEach((item, index) => {
            const galleryElement = document.createElement('div');
            galleryElement.className = 'gallery-item';
            galleryElement.style.animationDelay = `${index * 0.1}s`;
            galleryElement.style.animation = 'fadeIn 0.5s ease';
            
            galleryElement.innerHTML = `
                <img src="${item.url}" alt="Generated image" class="gallery-image">
                <div class="gallery-prompt">${this.truncateText(item.prompt, 100)}</div>
            `;
            
            galleryElement.addEventListener('click', () => {
                // Find the full item to get blob and original prompt
                const fullItem = this.gallery.find(g => g.url === item.url);
                if (fullItem) {
                    // We can't get the blob back from the gallery item easily, so we just show the image
                    // The main image display will use its own blob for download
                    this.generatedImage.src = fullItem.url;
                    this.generatedImage.alt = `AI generated: ${fullItem.prompt}`;
                    this.placeholderArea.style.display = 'none';
                    this.imageArea.style.display = 'block';
                    this.promptInput.value = fullItem.prompt;
                }
            });
            
            this.galleryContainer.appendChild(galleryElement);
        });
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    setLoading(isLoading) {
        this.generateBtn.classList.toggle('loading', isLoading);
        this.generateBtn.disabled = isLoading;
        this.variationsBtn.disabled = isLoading;
        this.regenerateBtn.disabled = isLoading;
        
        if (isLoading) {
            this.promptInput.disabled = true;
            this.styleSelect.disabled = true;
            this.aspectSelect.disabled = true;
            this.transparentCheckbox.disabled = true;
        } else {
            this.promptInput.disabled = false;
            this.styleSelect.disabled = false;
            this.aspectSelect.disabled = false;
            this.transparentCheckbox.disabled = false;
        }
    }

    showError(message) {
        const existingToast = document.querySelector('.error-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, #ff4757, #ff3838);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 10px 30px rgba(255, 71, 87, 0.3);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast) {
                toast.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3000);
    }
}

// Add CSS animations for toast
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .gallery-item {
        animation: fadeIn 0.5s ease;
    }
`;
document.head.appendChild(style);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new AIImageGenerator();
});