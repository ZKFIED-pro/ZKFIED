// Generate placeholder images with government/classified aesthetic
// These simulate the look of processed government documents and classified materials

export function generateGovernmentPlaceholder(filename: string): string {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  if (!ctx) return ''
  
  canvas.width = 400
  canvas.height = 200
  
  // Base color - dark government document look
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, 400, 200)
  
  // Different patterns based on filename
  if (filename.includes('government-database')) {
    // Government building silhouette
    ctx.fillStyle = '#333333'
    ctx.fillRect(50, 50, 100, 120)
    ctx.fillRect(200, 70, 120, 100)
    ctx.fillRect(100, 100, 80, 70)
    
    ctx.fillStyle = '#555555'
    ctx.font = '12px JetBrains Mono'
    ctx.fillText('CLASSIFIED DATABASE', 50, 30)
    ctx.fillText('ACCESS LOGS', 50, 190)
    
  } else if (filename.includes('corporate-retaliation')) {
    // Office documents pattern
    ctx.fillStyle = '#2a2a2a'
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(30, 30 + (i * 20), 340, 15)
    }
    
    ctx.fillStyle = '#555555'
    ctx.font = '12px JetBrains Mono'
    ctx.fillText('INTERNAL MEMO', 30, 20)
    ctx.fillText('HR DOCUMENTS', 250, 20)
    
  } else if (filename.includes('media-suppression')) {
    // Newspaper/media pattern
    ctx.fillStyle = '#333333'
    ctx.fillRect(30, 30, 150, 140)
    ctx.fillRect(200, 30, 150, 60)
    ctx.fillRect(200, 110, 150, 60)
    
    ctx.fillStyle = '#555555'
    ctx.font = '10px JetBrains Mono'
    ctx.fillText('PRESS RELEASE', 30, 20)
    ctx.fillText('REDACTED', 200, 20)
    
  } else if (filename.includes('classified-stamp')) {
    // Stamp/seal pattern
    ctx.fillStyle = '#333333'
    ctx.beginPath()
    ctx.arc(200, 100, 60, 0, 2 * Math.PI)
    ctx.fill()
    
    ctx.fillStyle = '#555555'
    ctx.font = '14px JetBrains Mono'
    ctx.textAlign = 'center'
    ctx.fillText('CLASSIFIED', 200, 105)
    
  } else if (filename.includes('file-cabinet')) {
    // Filing cabinet pattern
    ctx.fillStyle = '#2a2a2a'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(50, 40 + (i * 35), 300, 30)
    }
    
    ctx.fillStyle = '#555555'
    ctx.font = '10px JetBrains Mono'
    ctx.fillText('SURVEILLANCE FILES', 60, 30)
    
  } else if (filename.includes('court-building')) {
    // Government building
    ctx.fillStyle = '#333333'
    ctx.fillRect(100, 60, 200, 120)
    ctx.fillRect(120, 40, 20, 40)
    ctx.fillRect(160, 40, 20, 40)
    ctx.fillRect(200, 40, 20, 40)
    ctx.fillRect(240, 40, 20, 40)
    ctx.fillRect(280, 40, 20, 40)
    
    ctx.fillStyle = '#555555'
    ctx.font = '12px JetBrains Mono'
    ctx.textAlign = 'center'
    ctx.fillText('FEDERAL COURTHOUSE', 200, 30)
    
  } else {
    // Generic document
    ctx.fillStyle = '#2a2a2a'
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(40, 30 + (i * 16), 320, 12)
    }
    
    ctx.fillStyle = '#555555'
    ctx.font = '12px JetBrains Mono'
    ctx.fillText('OFFICIAL DOCUMENT', 40, 20)
  }
  
  // Add noise and texture for authentic look
  const imageData = ctx.getImageData(0, 0, 400, 200)
  const data = imageData.data
  
  for (let i = 0; i < data.length; i += 4) {
    // Add random noise
    if (Math.random() > 0.97) {
      const noise = Math.random() * 40 + 20
      data[i] = noise     // R
      data[i + 1] = noise // G
      data[i + 2] = noise // B
    }
    
    // Simulate scan lines
    const y = Math.floor((i / 4) / 400)
    if (y % 4 === 0) {
      data[i] *= 0.9
      data[i + 1] *= 0.9
      data[i + 2] *= 0.9
    }
  }
  
  ctx.putImageData(imageData, 0, 0)
  
  // Apply halftone effect
  applyBasicHalftone(ctx, 400, 200)
  
  return canvas.toDataURL()
}

function applyBasicHalftone(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  
  // Simple halftone pattern
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.floor((i / 4) / width)
    const x = (i / 4) % width
    
    // Create dot pattern
    const dotX = x % 6
    const dotY = y % 6
    const distFromCenter = Math.sqrt((dotX - 3) ** 2 + (dotY - 3) ** 2)
    
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3
    const threshold = (distFromCenter / 3) * 255
    
    const value = gray > threshold ? 255 : 0
    
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }
  
  ctx.putImageData(imageData, 0, 0)
}

// Generate all placeholder images
export function generateAllPlaceholders(): Map<string, string> {
  const placeholders = new Map<string, string>()
  
  const imageFiles = [
    'government-database.jpg',
    'corporate-retaliation.jpg',
    'media-suppression.jpg',
    'classified-stamp.jpg',
    'file-cabinet.jpg',
    'court-building.jpg',
    'official-letterhead.jpg',
    'redacted-document.jpg',
    'government-seal.jpg'
  ]
  
  imageFiles.forEach(filename => {
    placeholders.set(filename, generateGovernmentPlaceholder(filename))
  })
  
  return placeholders
}