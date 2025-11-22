// Canvas-based halftone and dithering effects for SportsTensor aesthetic
// Creates aggressive B&W pixelated images with visible dot patterns

export function applyHalftoneEffect(imageElement: HTMLImageElement): void {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) return
  
  // Create a new image to avoid CORS issues
  const img = new Image()
  img.crossOrigin = 'anonymous'
  
  img.onload = () => {
    try {
      // Set canvas dimensions
      canvas.width = img.width
      canvas.height = img.height
      
      // Draw image
      ctx.drawImage(img, 0, 0)
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        
        // Grayscale formula
        let gray = r * 0.299 + g * 0.587 + b * 0.114
        
        // High contrast boost (match SportsTensor exactly)
        gray = (gray - 128) * 1.6 + 128
        gray = Math.max(0, Math.min(255, gray * 0.85))
        
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      
      // Apply ordered dithering (Bayer matrix for dot pattern)
      const bayerMatrix = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
      ]
      
      for (let i = 0; i < data.length; i += 4) {
        const y = Math.floor((i / 4) / canvas.width)
        const x = (i / 4) % canvas.width
        
        const bayerValue = bayerMatrix[y % 4][x % 4] / 16
        const gray = data[i]
        const threshold = gray + (bayerValue * 64) // Adjust threshold for visibility
        
        const bw = threshold > 128 ? 255 : 0
        
        data[i] = bw
        data[i + 1] = bw
        data[i + 2] = bw
      }
      
      ctx.putImageData(imageData, 0, 0)
      
      // Replace image with processed canvas
      imageElement.src = canvas.toDataURL()
      imageElement.classList.add('halftone-processed')
      
    } catch (error) {
      console.warn('Could not apply halftone effect to image:', error)
    }
  }
  
  img.onerror = () => {
    console.warn('Failed to load image for halftone processing')
  }
  
  img.src = imageElement.src
}

export function applyAggressiveDithering(imageElement: HTMLImageElement): void {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) return
  
  const img = new Image()
  img.crossOrigin = 'anonymous'
  
  img.onload = () => {
    try {
      canvas.width = img.width
      canvas.height = img.height
      
      ctx.drawImage(img, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // More aggressive processing
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        
        // Weighted grayscale
        let gray = r * 0.299 + g * 0.587 + b * 0.114
        
        // Extreme contrast (SportsTensor style)
        gray = gray > 128 ? 255 : 0
        
        // Add noise for texture
        const noise = (Math.random() - 0.5) * 40
        gray = Math.max(0, Math.min(255, gray + noise))
        
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      
      ctx.putImageData(imageData, 0, 0)
      imageElement.src = canvas.toDataURL()
      imageElement.classList.add('aggressive-dither-processed')
      
    } catch (error) {
      console.warn('Could not apply aggressive dithering:', error)
    }
  }
  
  img.src = imageElement.src
}

// Initialize image processing on page load
export function initializeImageProcessing(): void {
  const processImages = () => {
    const evidenceImages = document.querySelectorAll('.evidence-thumbnail') as NodeListOf<HTMLImageElement>
    
    evidenceImages.forEach((img) => {
      if (!img.classList.contains('halftone-processed')) {
        // Add loading delay to ensure image is loaded
        if (img.complete) {
          applyHalftoneEffect(img)
        } else {
          img.addEventListener('load', () => applyHalftoneEffect(img))
        }
      }
    })
  }
  
  // Process images immediately
  processImages()
  
  // Watch for new images being added to DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          const images = node.querySelectorAll('.evidence-thumbnail') as NodeListOf<HTMLImageElement>
          images.forEach((img) => {
            if (!img.classList.contains('halftone-processed')) {
              if (img.complete) {
                applyHalftoneEffect(img)
              } else {
                img.addEventListener('load', () => applyHalftoneEffect(img))
              }
            }
          })
        }
      })
    })
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

// Placeholder image generator for missing images
export function generatePlaceholderImage(width: number = 400, height: number = 200): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) return ''
  
  canvas.width = width
  canvas.height = height
  
  // Dark background
  ctx.fillStyle = '#111111'
  ctx.fillRect(0, 0, width, height)
  
  // Terminal-style text
  ctx.fillStyle = '#666666'
  ctx.font = '14px JetBrains Mono, monospace'
  ctx.textAlign = 'center'
  ctx.fillText('[CLASSIFIED_IMAGE]', width / 2, height / 2)
  
  // Add some noise for texture
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() > 0.95) {
      const noise = Math.random() * 60
      data[i] = noise     // R
      data[i + 1] = noise // G
      data[i + 2] = noise // B
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  return canvas.toDataURL()
}