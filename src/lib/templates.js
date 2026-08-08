/**
 * Built-in geometric templates (config only — shapes are drawn in code, no image assets).
 */
var WordCloudArtTemplates = [
  {
    id: 'classic',
    name: 'Classic',
    shape: 'none',
    palette: 'ocean',
    allowRotate: true,
    maxWords: 80,
    aspect: 'landscape'
  },
  {
    id: 'circle',
    name: 'Circle',
    shape: 'circle',
    palette: 'ocean',
    allowRotate: true,
    maxWords: 70,
    aspect: 'square'
  },
  {
    id: 'square',
    name: 'Square',
    shape: 'square',
    palette: 'mono',
    allowRotate: false,
    maxWords: 70,
    aspect: 'square'
  },
  {
    id: 'rounded',
    name: 'Rounded',
    shape: 'rounded',
    palette: 'forest',
    allowRotate: true,
    maxWords: 70,
    aspect: 'square'
  },
  {
    id: 'triangle',
    name: 'Triangle',
    shape: 'triangle',
    palette: 'sunset',
    allowRotate: false,
    maxWords: 55,
    aspect: 'square'
  },
  {
    id: 'diamond',
    name: 'Diamond',
    shape: 'diamond',
    palette: 'berry',
    allowRotate: true,
    maxWords: 55,
    aspect: 'square'
  },
  {
    id: 'hexagon',
    name: 'Hexagon',
    shape: 'hexagon',
    palette: 'ocean',
    allowRotate: true,
    maxWords: 65,
    aspect: 'square'
  },
  {
    id: 'star',
    name: 'Star',
    shape: 'star',
    palette: 'sunset',
    allowRotate: false,
    maxWords: 50,
    aspect: 'square'
  },
  {
    id: 'heart',
    name: 'Heart',
    shape: 'heart',
    palette: 'berry',
    allowRotate: true,
    maxWords: 55,
    aspect: 'square'
  },
  {
    id: 'oval',
    name: 'Oval',
    shape: 'oval',
    palette: 'forest',
    allowRotate: true,
    maxWords: 70,
    aspect: 'landscape'
  },
  {
    id: 'cloud',
    name: 'Cloud',
    shape: 'cloud',
    palette: 'ocean',
    allowRotate: true,
    maxWords: 65,
    aspect: 'landscape'
  },
  {
    id: 'arrow',
    name: 'Arrow',
    shape: 'arrow',
    palette: 'mono',
    allowRotate: false,
    maxWords: 50,
    aspect: 'landscape'
  }
];

function getTemplateById(id) {
  for (var i = 0; i < WordCloudArtTemplates.length; i++) {
    if (WordCloudArtTemplates[i].id === id) return WordCloudArtTemplates[i];
  }
  return WordCloudArtTemplates[0];
}
