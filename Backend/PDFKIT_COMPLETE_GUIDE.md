# 📘 PDFKit Complete Guide - Creating Awesome PDFs

> **Ultimate reference guide for building professional, beautiful PDF documents with PDFKit**

---

## 📑 Table of Contents

1. [Getting Started](#getting-started)
2. [Page Management](#page-management)
3. [Vector Graphics](#vector-graphics)
4. [Text Handling](#text-handling)
5. [Images](#images)
6. [Tables](#tables)
7. [Annotations](#annotations)
8. [Forms](#forms)
9. [Destinations & Navigation](#destinations--navigation)
10. [Attachments](#attachments)
11. [Outlines (Bookmarks)](#outlines-bookmarks)
12. [Accessibility](#accessibility)
13. [Advanced Features](#advanced-features)
14. [Best Practices](#best-practices)
15. [Real-World Examples](#real-world-examples)

---

## 🚀 Getting Started

### Installation

```bash
npm install pdfkit
```

### Basic Document Creation

```javascript
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Create a document
const doc = new PDFDocument();

// Pipe to file or HTTP response
doc.pipe(fs.createWriteStream('output.pdf'));
// or
doc.pipe(res); // HTTP response

// Add content
doc.text('Hello, World!');

// Finalize PDF
doc.end();
```

### Document Options

```javascript
const doc = new PDFDocument({
  // Page settings
  size: 'A4',                    // or [width, height] in points
  layout: 'portrait',            // or 'landscape'
  margin: 50,                    // All sides, or use margins: {top, bottom, left, right}
  
  // Buffering
  bufferPages: true,             // Enable page switching
  autoFirstPage: true,           // Auto-create first page (default: true)
  
  // Metadata
  info: {
    Title: 'My Document',
    Author: 'John Doe',
    Subject: 'Example PDF',
    Keywords: 'pdf, example'
  },
  
  // Security
  userPassword: 'user123',       // Password to open
  ownerPassword: 'owner123',     // Password for permissions
  permissions: {
    printing: 'highResolution',
    modifying: false,
    copying: true
  },
  
  // PDF/A archiving
  subset: 'PDF/UA',              // PDF/A-1, PDF/A-2, PDF/A-3, PDF/UA
  pdfVersion: '1.7',             // 1.3, 1.4, 1.5, 1.6, 1.7, 1.7ext3
  tagged: true,                  // For accessible PDFs
  displayTitle: true,            // Show title in viewer
  
  // Other
  font: 'Helvetica',             // Default font
  compress: true                 // Compress content (default: true)
});
```

---

## 📄 Page Management

### Adding Pages

```javascript
// Add new page with default settings
doc.addPage();

// Add page with custom options
doc.addPage({
  size: 'A4',
  layout: 'landscape',
  margin: 20,
  margins: {
    top: 50,
    bottom: 50,
    left: 72,
    right: 72
  }
});
```

### Page Sizes

**ISO A-series:** A0, A1, A2, A3, A4 *(most common)*, A5, A6, A7, A8, A9, A10

**ISO B-series:** B0, B1, B2, B3, B4, B5, B6, B7, B8, B9, B10

**ISO C-series:** C0, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10

**US Sizes:** LETTER, LEGAL, TABLOID, EXECUTIVE, FOLIO

**Custom Size:**
```javascript
doc.addPage({ size: [612, 792] }); // Width x Height in points (72 points = 1 inch)
```

### Margin Units

Supports: `pt` (points), `in` (inches), `cm`, `mm`, `px`, `em`, `rem`, `%`

```javascript
doc.addPage({ margin: '1in' });       // 1 inch all sides
doc.addPage({ margin: '2cm' });       // 2 centimeters
doc.addPage({ margin: '50mm' });      // 50 millimeters
```

### Switching Between Pages (Buffering)

```javascript
// Enable buffering when creating document
const doc = new PDFDocument({ bufferPages: true });

doc.addPage(); // Page 0
doc.text('Page 1');

doc.addPage(); // Page 1
doc.text('Page 2');

// Switch back to page 0
doc.switchToPage(0);
doc.text('Added to Page 1 later');

// Get buffered page range
const range = doc.bufferedPageRange();
// => { start: 0, count: 2 }

// Add page numbers to all pages
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  doc.text(`Page ${i + 1} of ${range.count}`, 0, doc.page.height - 50, {
    align: 'center'
  });
}

// Flush pages manually (or doc.end() does it automatically)
doc.flushPages();
```

### Page Events

```javascript
// Execute code whenever a new page is added
doc.on('pageAdded', () => {
  doc.text('Header on every page', { align: 'center' });
});
```

### Getting Page Properties

```javascript
doc.page.width     // Page width in points
doc.page.height    // Page height in points
doc.page.margins   // { top, bottom, left, right }
doc.x              // Current X position
doc.y              // Current Y position
```

---

## 🎨 Vector Graphics

### Basic Shapes

```javascript
// Rectangle
doc.rect(x, y, width, height);

// Rounded rectangle
doc.roundedRect(x, y, width, height, cornerRadius);

// Circle
doc.circle(centerX, centerY, radius);

// Ellipse
doc.ellipse(centerX, centerY, radiusX, radiusY);

// Polygon
doc.polygon([100, 0], [50, 100], [150, 100]); // Array of [x, y] points

// Must call fill() or stroke() to render
doc.stroke();
```

### Lines and Curves

```javascript
// Move to starting point
doc.moveTo(x, y);

// Draw straight line
doc.lineTo(x, y);

// Quadratic curve
doc.quadraticCurveTo(controlX, controlY, endX, endY);

// Bezier curve
doc.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);

// Close path
doc.closePath();

// Render
doc.stroke();
```

### SVG Paths

```javascript
// Use SVG path syntax
doc.path('M 0,20 L 100,160 Q 130,200 150,120 C 190,-40 200,200 300,150')
   .stroke();
```

### Fill and Stroke

```javascript
// Stroke (outline) only
doc.rect(50, 50, 100, 100)
   .stroke();

// Fill only
doc.rect(200, 50, 100, 100)
   .fill('#ff0000');

// Both fill and stroke
doc.rect(350, 50, 100, 100)
   .fillAndStroke('#00ff00', '#000000');
```

### Line Styles

```javascript
// Line width
doc.lineWidth(5);

// Line cap: 'butt', 'round', 'square'
doc.lineCap('round');

// Line join: 'miter', 'round', 'bevel'
doc.lineJoin('round');

// Miter limit (for 'miter' join)
doc.miterLimit(10);

// Dashed lines
doc.dash(5, { space: 10, phase: 0 }); // 5pt dash, 10pt space
doc.undash(); // Remove dash
```

### Colors

**Multiple color formats:**

```javascript
// Hex color
doc.fillColor('#ff0000');
doc.strokeColor('#00ff00');

// RGB array
doc.fillColor([255, 0, 0]);

// CMYK array
doc.fillColor([0, 100, 100, 0]);

// Named CSS colors
doc.fillColor('red');
doc.strokeColor('blue');

// With opacity
doc.fillColor('red', 0.5); // 50% opacity
doc.strokeColor('blue', 0.8);

// Separate opacity methods
doc.fillOpacity(0.5);
doc.strokeOpacity(0.8);
doc.opacity(0.5); // Sets both fill and stroke
```

### Gradients

**Linear Gradient:**

```javascript
// Create gradient from (x1,y1) to (x2,y2)
const grad = doc.linearGradient(50, 0, 150, 100);

// Add color stops (0 to 1)
grad.stop(0, 'green')
    .stop(0.5, 'yellow')
    .stop(1, 'red');

// Apply gradient
doc.rect(50, 0, 100, 100)
   .fill(grad);
```

**Radial Gradient:**

```javascript
// Create radial gradient
// (x1, y1, innerRadius, x2, y2, outerRadius)
const grad = doc.radialGradient(300, 50, 0, 300, 50, 50);

grad.stop(0, 'orange', 0)    // Color, opacity
    .stop(1, 'orange', 1);

doc.circle(300, 50, 50)
   .fill(grad);
```

### Transformations

```javascript
// Translate (move origin)
doc.translate(100, 50);

// Rotate (in degrees)
doc.rotate(45, { origin: [150, 100] }); // Rotate around point

// Scale
doc.scale(0.5);                         // Uniform scaling
doc.scale(2, 1);                        // X and Y scale separately

// Custom transformation matrix
doc.transform(a, b, c, d, e, f);
```

### Saving and Restoring State

```javascript
// Save current graphics state
doc.save();

// Make changes
doc.fillColor('red');
doc.translate(100, 100);
doc.rotate(45);
doc.rect(0, 0, 50, 50).fill();

// Restore previous state
doc.restore();

// Now back to original color, position, rotation
```

### Clipping

```javascript
// Create clipping path
doc.circle(100, 100, 100)
   .clip();

// Everything drawn now is clipped to the circle
for (let row = 0; row < 10; row++) {
  for (let col = 0; col < 10; col++) {
    const color = (col % 2) - (row % 2) ? '#eee' : '#4183C4';
    doc.rect(row * 20, col * 20, 20, 20).fill(color);
  }
}

// To "unclip", use save/restore
doc.save();
doc.circle(100, 100, 50).clip();
// Clipped drawing
doc.restore();
// No longer clipped
```

---

## 📝 Text Handling

### Basic Text

```javascript
// Simple text
doc.text('Hello, World!');

// Text at specific position
doc.text('Hello', 100, 50);

// Move down/up lines
doc.moveDown(2);   // Move down 2 lines
doc.moveUp(1);     // Move up 1 line
```

### Fonts

**Standard PDF Fonts (built-in):**
- `Courier`, `Courier-Bold`, `Courier-Oblique`, `Courier-BoldOblique`
- `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`, `Helvetica-BoldOblique`
- `Times-Roman`, `Times-Bold`, `Times-Italic`, `Times-BoldItalic`
- `Symbol`, `ZapfDingbats`

```javascript
// Use standard font
doc.font('Helvetica-Bold')
   .fontSize(18)
   .text('Bold Text');

// Use custom font file
doc.font('fonts/CustomFont.ttf')
   .fontSize(14)
   .text('Custom Font Text');

// Use font from collection (.ttc, .dfont)
doc.font('fonts/FontCollection.ttc', 'FontName-Bold');

// Register font for reuse
doc.registerFont('MyFont', 'fonts/CustomFont.ttf');
doc.font('MyFont').text('Using registered font');
```

**⚠️ Important:** Standard PDF fonts (Helvetica, Times, Courier) do NOT support Unicode emoji or special symbols. Use TrueType fonts (.ttf) for Unicode support.

### Text Styling

```javascript
doc.text('Styled text', {
  // Size and font
  fontSize: 14,
  
  // Alignment: 'left', 'center', 'right', 'justify'
  align: 'center',
  
  // Width and wrapping
  width: 400,
  height: 200,
  lineBreak: true,          // Enable/disable wrapping (default: true)
  
  // Spacing
  indent: 20,               // First line indent
  indentAllLines: false,    // Indent all lines (default: false)
  paragraphGap: 10,         // Space between paragraphs
  lineGap: 2,               // Space between lines
  wordSpacing: 0,           // Space between words
  characterSpacing: 0,      // Space between characters
  
  // Decoration
  underline: true,
  strike: true,
  oblique: 15,              // Slant angle (or true for default)
  
  // Multi-column
  columns: 3,
  columnGap: 15,
  
  // Text truncation
  ellipsis: true,           // Show "..." if too long
  
  // Links
  link: 'https://example.com',
  goTo: 'anchorName',
  destination: 'anchorName',
  
  // Rich text
  continued: true,          // Continue on next text() call
  
  // OpenType features
  features: ['liga', 'dlig'],  // Ligatures
  
  // Other
  rotation: 45,             // Rotate text (degrees)
  baseline: 'top',          // Vertical alignment
  horizontalScaling: 100    // Scale text horizontally (%)
});
```

### Text Measurements

```javascript
// Get text width
const width = doc.widthOfString('Hello World');

// Get text height
const height = doc.heightOfString('Hello World', { width: 200 });

// Get bounding box (with rotation)
const bounds = doc.boundsOfString('Hello', 100, 50, { rotation: 45 });
// => { x: number, y: number, width: number, height: number }
```

### Line Wrapping and Justification

```javascript
const lorem = 'Lorem ipsum dolor sit amet...';

// Left aligned (default)
doc.text(lorem, {
  width: 400,
  align: 'left'
});

// Center aligned
doc.text(lorem, {
  width: 400,
  align: 'center'
});

// Right aligned
doc.text(lorem, {
  width: 400,
  align: 'right'
});

// Justified
doc.text(lorem, {
  width: 400,
  align: 'justify'
});
```

### Multi-Column Text

```javascript
doc.text(longText, {
  columns: 3,
  columnGap: 20,
  width: 500,
  height: 300,
  align: 'justify'
});
```

### Rich Text (Multiple Styles)

```javascript
// Continue text with different styles
doc.fillColor('black')
   .fontSize(12)
   .text('This is ', { continued: true })
   .fillColor('red')
   .font('Helvetica-Bold')
   .text('important', { continued: true })
   .fillColor('black')
   .font('Helvetica')
   .text(' text.');

// Cancel link in rich text
doc.text('Regular text ', { link: null, continued: true });
```

### Lists

```javascript
// Simple bulleted list
doc.list(['Item 1', 'Item 2', 'Item 3']);

// Nested list
doc.list([
  'First item',
  ['Sub-item 1', 'Sub-item 2'],
  'Third item'
]);

// List with custom options
doc.list(['Item 1', 'Item 2'], 100, 100, {
  bulletRadius: 3,
  textIndent: 20,
  bulletIndent: 10
});
```

---

## 🖼️ Images

### Adding Images

```javascript
// From file path
doc.image('path/to/image.jpg', x, y);

// From buffer
const imgBuffer = fs.readFileSync('image.png');
doc.image(imgBuffer, x, y);

// From data URI
doc.image('data:image/png;base64,iVBORw0KG...', x, y);
```

**Supported formats:** JPEG, PNG

### Image Sizing Options

```javascript
// Full size (no options)
doc.image('image.jpg', 100, 100);

// Scale to width (maintains aspect ratio)
doc.image('image.jpg', 100, 100, { width: 300 });

// Scale to height (maintains aspect ratio)
doc.image('image.jpg', 100, 100, { height: 200 });

// Stretch to exact dimensions
doc.image('image.jpg', 100, 100, { width: 300, height: 200 });

// Scale by factor
doc.image('image.jpg', 100, 100, { scale: 0.5 }); // 50% size

// Fit within box (maintains aspect ratio)
doc.image('image.jpg', 100, 100, {
  fit: [300, 200],
  align: 'center',    // 'left', 'center', 'right'
  valign: 'center'    // 'top', 'center', 'bottom'
});

// Cover box (maintains aspect ratio, may crop)
doc.image('image.jpg', 100, 100, {
  cover: [300, 200],
  align: 'center',
  valign: 'center'
});
```

### Image in Text Flow

```javascript
// Image flows with text (no x, y specified)
doc.text('Here is an image:');
doc.image('image.jpg', { width: 200 });
doc.text('Text continues after image');
```

### Image Links

```javascript
// Make image clickable
doc.image('image.jpg', 100, 100, {
  width: 200,
  link: 'https://example.com'
});

// Link to anchor in document
doc.image('image.jpg', 100, 100, {
  width: 200,
  goTo: 'section1'
});

// Create anchor at image
doc.image('image.jpg', 100, 100, {
  width: 200,
  destination: 'imageAnchor'
});
```

### JPEG EXIF Orientation

```javascript
// Ignore EXIF orientation (keep as-is)
doc.image('photo.jpg', 100, 100, {
  ignoreOrientation: true
});

// Or set globally
const doc = new PDFDocument({ ignoreOrientation: true });
```

---

## 📊 Tables

### Simple Table

```javascript
doc.table({
  data: [
    ['Header 1', 'Header 2', 'Header 3'],
    ['Row 1 Col 1', 'Row 1 Col 2', 'Row 1 Col 3'],
    ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3']
  ]
});
```

### Using Row Method

```javascript
doc.table()
   .row(['Header 1', 'Header 2', 'Header 3'])
   .row(['Data 1', 'Data 2', 'Data 3']);
```

### Column Widths

```javascript
doc.table({
  columnStyles: [
    100,        // Fixed width in points
    '*',        // Star-sized (fills remaining space equally)
    200,        // Another fixed width
    '*'         // Another star-sized
  ],
  data: [
    ['100pt', 'star', '200pt', 'star'],
    ['Fixed', 'Flexible', 'Fixed', 'Flexible']
  ]
});
```

### Row Heights

```javascript
// Specific heights
doc.table({
  rowStyles: [20, 50, 70],  // Heights for rows 0, 1, 2
  data: [/*...*/]
});

// Same height for all
doc.table({
  rowStyles: 40,
  data: [/*...*/]
});

// Dynamic heights from function
doc.table({
  rowStyles: (row) => (row + 1) * 25,  // Row 0=25pt, Row 1=50pt, etc.
  data: [/*...*/]
});
```

### Cell Spans

```javascript
doc.table({
  columnStyles: [200, '*', '*'],
  data: [
    // Header row with colspan
    [
      { colSpan: 2, text: 'Spans 2 columns' },
      'Column 3'
    ],
    
    // Regular row
    ['Col 1', 'Col 2', 'Col 3'],
    
    // Row with rowspan
    [
      { rowSpan: 3, text: 'Spans 3 rows' },
      'Col 2',
      'Col 3'
    ],
    ['Col 2', 'Col 3'],  // Row 3 (rowspan continues)
    ['Col 2', 'Col 3'],  // Row 4 (rowspan continues)
    
    // Both rowspan and colspan
    [
      'Col 1',
      { colSpan: 2, rowSpan: 2, text: 'Spans 2x2' }
    ],
    ['Col 1']  // Row 6 (span continues)
  ]
});
```

### Table Styling

**No borders:**

```javascript
doc.table({
  rowStyles: { border: false },
  data: [/*...*/]
});
```

**Header line only:**

```javascript
doc.table({
  rowStyles: (i) => {
    return i < 1 
      ? { border: [0, 0, 1, 0] }  // Bottom border only
      : { border: false };
  },
  data: [/*...*/]
});
```

**Light horizontal lines:**

```javascript
doc.table({
  rowStyles: (i) => {
    return i < 1
      ? { border: [0, 0, 2, 0], borderColor: 'black' }
      : { border: [0, 0, 1, 0], borderColor: '#aaa' };
  },
  data: [/*...*/]
});
```

**Zebra striping:**

```javascript
doc.table({
  rowStyles: (i) => {
    if (i % 2 === 0) return { backgroundColor: '#ccc' };
  },
  data: [/*...*/]
});
```

**Custom borders:**

```javascript
doc.table({
  defaultStyle: {
    border: 1,
    borderColor: 'gray'
  },
  columnStyles: (i) => {
    if (i === 0) return { border: { left: 2 }, borderColor: { left: 'black' } };
    if (i === 2) return { border: { right: 2 }, borderColor: { right: 'black' } };
  },
  rowStyles: (i) => {
    if (i === 0) return { border: { top: 2 }, borderColor: { top: 'black' } };
    if (i === 3) return { border: { bottom: 2 }, borderColor: { bottom: 'black' } };
  },
  data: [/*...*/]
});
```

### Cell Options

```javascript
doc.table({
  data: [
    [
      {
        text: 'Cell content',
        backgroundColor: '#f0f0f0',
        textColor: '#333',
        padding: 10,
        border: [1, 1, 1, 1],  // [top, right, bottom, left]
        borderColor: 'black',
        font: 'Helvetica-Bold',
        align: { x: 'center', y: 'top' },
        textStroke: 0,
        textStrokeColor: 'black'
      },
      'Simple text'
    ]
  ]
});
```

### Table Options

```javascript
doc.table({
  // Position
  position: { x: 50, y: 100 },
  
  // Max width
  maxWidth: 500,
  
  // Column and row styles
  columnStyles: [/*...*/],
  rowStyles: [/*...*/],
  
  // Default style for all cells
  defaultStyle: {
    border: 1,
    padding: 5,
    font: 'Helvetica'
  },
  
  // Data
  data: [/*...*/],
  
  // Debug mode
  debug: false
});
```

### Style Precedence

Styles are applied in this order (later overrides earlier):

1. `defaultStyle`
2. `columnStyles`
3. `rowStyles`
4. Cell-specific style

Example:

```javascript
doc.table({
  defaultStyle: { border: 1 },
  columnStyles: { border: { right: 2 } },
  rowStyles: { border: { bottom: 3 } },
  data: [[{ border: { left: 4 } }]]
});

// Resulting cell: { border: { top: 1, right: 2, bottom: 3, left: 4 } }
```

---

## 🔗 Annotations

Annotations are interactive features that make PDFs more engaging with links, notes, highlights, and more.

### Annotation Types

```javascript
// Note annotation
doc.note(x, y, width, height, 'Note content', {
  Name: 'Comment',  // Icon: 'Comment', 'Key', 'Note', 'Help', 'NewParagraph', 'Paragraph', 'Insert'
  color: 'yellow'
});

// Link annotation
doc.link(x, y, width, height, 'https://example.com', {
  color: 'blue'
});

// Internal link (go to destination)
doc.goTo(x, y, width, height, 'destinationName', {
  color: 'green'
});

// Highlight annotation
doc.highlight(x, y, width, height, {
  color: 'yellow'
});

// Underline annotation
doc.underline(x, y, width, height, {
  color: 'blue'
});

// Strike through annotation
doc.strike(x, y, width, height, {
  color: 'red'
});

// Line annotation
doc.lineAnnotation(x1, y1, x2, y2, {
  color: 'black',
  lineWidth: 2
});

// Rectangle annotation
doc.rectAnnotation(x, y, width, height, {
  color: 'red'
});

// Ellipse annotation
doc.ellipseAnnotation(x, y, width, height, {
  color: 'blue'
});

// Text annotation
doc.textAnnotation(x, y, width, height, 'Annotation text', {
  color: 'green'
});

// File annotation (see Attachments section)
doc.fileAnnotation(x, y, width, height, fileObject, {
  Name: 'Paperclip'
});
```

### Text Annotations with Helper Methods

**Measuring text for annotations:**

```javascript
// Get text dimensions
const text = 'This is a link!';
const width = doc.widthOfString(text);
const height = doc.currentLineHeight();

// Add link with underline
doc.fontSize(25)
   .fillColor('blue')
   .text(text, 20, 0);

doc.underline(20, 0, width, height, { color: 'blue' })
   .link(20, 0, width, height, 'http://google.com/');
```

**Inline text annotations (easier method):**

```javascript
// Link with automatic underline
doc.fontSize(20)
   .fillColor('red')
   .text('Another link!', 20, 0, {
     link: 'http://apple.com/',
     underline: true
   });

// Strike through text
doc.text('STRIKE!', {
  strike: true
});

// Highlight text
doc.text('Highlighted text', {
  highlight: true
});
```

### Annotation Examples

**Creating linked text with highlight:**

```javascript
// Highlighted link
doc.moveDown()
   .fillColor('black')
   .highlight(20, doc.y, doc.widthOfString('Click here!'), doc.currentLineHeight())
   .text('Click here!', 20, doc.y, {
     link: 'https://example.com',
     underline: true
   });
```

**Adding notes with custom icons:**

```javascript
// Default comment icon
doc.note(10, 30, 30, 30, 'Text of note');

// Custom icon with color
doc.note(10, 80, 30, 30, 'Important note', {
  Name: 'Key',
  color: 'red'
});
```

**Spot colors in annotations:**

```javascript
// Add spot color
doc.addSpotColor('PANTONE185C', 0, 100, 78, 9);

// Use in text
doc.fillColor('PANTONE185C')
   .text('This text uses spot color!');
```

### Annotation Stacking Order

⚠️ **Important:** Annotations have a stacking order. If you place multiple annotations on the same area and one is a link, ensure the link is added **last** so it's clickable.

```javascript
// ❌ Bad: Link will be covered
doc.link(20, 20, 100, 30, 'https://example.com');
doc.highlight(20, 20, 100, 30); // Covers the link!

// ✅ Good: Link is on top
doc.highlight(20, 20, 100, 30);
doc.link(20, 20, 100, 30, 'https://example.com'); // Clickable
```

---

## 📝 Forms

Interactive PDF forms allow users to fill in data directly in the PDF viewer.

### Initializing Forms

```javascript
// Must call before adding form fields
doc.font('Helvetica'); // Set default font for form fields
doc.initForm();
```

### Form Field Types

**Text Field:**

```javascript
// Basic text field
doc.formText('fieldName', x, y, width, height, {
  value: 'Default text',
  defaultValue: 'Reset value',
  backgroundColor: '#f0f0f0',
  borderColor: 'black',
  align: 'left',        // 'left', 'center', 'right'
  multiline: false,
  password: false,      // Mask with asterisks
  readOnly: false,
  required: true,
  noExport: false,
  noSpell: false,       // Disable spell check
  fontSize: 12          // 0 = auto-sizing
});

// Multiline text area
doc.formText('comments', 10, 60, 200, 80, {
  multiline: true,
  align: 'left'
});

// Password field
doc.formText('password', 10, 150, 200, 25, {
  password: true
});
```

**Combo Box (Dropdown):**

```javascript
doc.formCombo('country', 10, 200, 150, 25, {
  select: ['', 'USA', 'Canada', 'Mexico'],
  value: 'USA',
  defaultValue: '',
  sort: true,           // Sort alphabetically
  edit: true,           // Allow custom input
  noSpell: false,
  backgroundColor: 'white',
  align: 'left'
});
```

**List Box:**

```javascript
doc.formList('options', 10, 250, 150, 100, {
  select: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
  multiSelect: true,    // Allow multiple selections
  sort: false
});
```

**Push Button:**

```javascript
doc.formPushButton('submitBtn', 10, 370, 100, 30, {
  label: 'Submit Form',
  backgroundColor: '#4CAF50',
  borderColor: '#45a049'
});
```

### Text Field Formatting

**Date format:**

```javascript
doc.formText('dateField', 10, 60, 200, 40, {
  align: 'center',
  format: {
    type: 'date',
    param: 'mmmm d, yyyy'  // 'October 28, 2025'
    // Formats: d, dd, m, mm, mmm, mmmm, yy, yyyy, hh, HH, MM, tt
  }
});

// Common date formats:
// 'm/d/yyyy'     → 10/28/2025
// 'dd/mm/yyyy'   → 28/10/2025
// 'mmmm d, yyyy' → October 28, 2025
```

**Time format:**

```javascript
doc.formText('timeField', 10, 110, 200, 40, {
  format: {
    type: 'time',
    param: 0  // 0='14:30', 1='2:30 PM', 2='14:30:15', 3='2:30:15 PM'
  }
});
```

**Number format:**

```javascript
doc.formText('priceField', 10, 160, 200, 40, {
  format: {
    type: 'number',
    nDec: 2,              // Decimal places
    sepComma: true,       // Thousand separator
    negStyle: 'ParensRed', // 'MinusBlack', 'Red', 'ParensBlack', 'ParensRed'
    currency: '$',
    currencyPrepend: true // true='$100', false='100$'
  }
});
```

**Percent format:**

```javascript
doc.formText('percentField', 10, 210, 200, 40, {
  format: {
    type: 'percent',
    nDec: 1,
    sepComma: false
  }
});
```

**Predefined formats:**

```javascript
// ZIP code
doc.formText('zip', 10, 260, 100, 25, {
  format: { type: 'zip' }
});

// ZIP+4
doc.formText('zipPlus4', 10, 295, 120, 25, {
  format: { type: 'zipPlus4' }
});

// Phone number
doc.formText('phone', 10, 330, 150, 25, {
  format: { type: 'phone' }
});

// Social Security Number
doc.formText('ssn', 10, 365, 120, 25, {
  format: { type: 'ssn' }
});
```

### Hierarchical Field Names

```javascript
// Use periods to create hierarchy: parent.child.field
doc.formText('shipping.address.street', 10, 10, 200, 25);
doc.formText('shipping.address.city', 10, 40, 200, 25);
doc.formText('shipping.address.zip', 10, 70, 100, 25);

doc.formText('billing.address.street', 10, 110, 200, 25);
doc.formText('billing.address.city', 10, 140, 200, 25);
doc.formText('billing.address.zip', 10, 170, 100, 25);
```

### Form Fields with Parent References

```javascript
// Create form field hierarchy
const rootField = doc.formField('rootField');
const child1Field = doc.formField('child1Field', { parent: rootField });
const child2Field = doc.formField('child2Field', { parent: rootField });

// Add form annotations to fields
doc.formText('leaf1', 10, 10, 200, 40, {
  parent: child1Field,
  multiline: true
});

doc.formText('leaf2', 10, 60, 200, 40, {
  parent: child1Field,
  multiline: true
});

doc.formText('leaf1', 10, 110, 200, 80, {
  parent: child2Field,
  multiline: true
});

// Resulting field names:
// rootField.child1Field.leaf1
// rootField.child1Field.leaf2
// rootField.child2Field.leaf1
```

### Named JavaScript in Forms

```javascript
// Add named JavaScript for form actions
doc.addNamedJavaScript('validateEmail', `
  var email = this.getField("email").value;
  if (!email.includes("@")) {
    app.alert("Invalid email address");
  }
`);
```

### Form Limitations

⚠️ **Important Notes:**

- **Radio buttons and checkboxes** are not yet supported
- **Appearances:** PDFKit sets `NeedAppearances=true`, so Adobe Reader generates appearances on open
- **JavaScript:** Not all PDF viewers support JavaScript (especially mobile)
- **Testing:** Always test forms across target platforms
- **Fonts:** Font for form fields is set via `doc.font()` before `initForm()`

---

## 🧭 Destinations & Navigation

Destinations (anchors) enable navigation within PDFs.

### Creating Destinations

```javascript
// Simple destination at current position
doc.addNamedDestination('LINK');

// Destination with fit options
doc.addNamedDestination('SECTION1', 'FitH', 100);
// FitH = Fit horizontal at vertical position 100

// Destination with specific position and zoom
doc.addNamedDestination('DETAIL', 'XYZ', 36, 36, 50);
// XYZ = Position (36, 36) with 50% zoom

// Destination in text
doc.text('End of paragraph', { destination: 'ENDP' });
```

### Destination Fit Types

```javascript
// Fit entire page in window
doc.addNamedDestination('PAGE1', 'Fit');

// Fit page width
doc.addNamedDestination('PAGE2', 'FitH', top);

// Fit page height
doc.addNamedDestination('PAGE3', 'FitV', left);

// Fit rectangle in window
doc.addNamedDestination('RECT', 'FitR', left, bottom, right, top);

// Fit bounding box
doc.addNamedDestination('BBOX', 'FitB');

// Fit bounding box width
doc.addNamedDestination('BBOXH', 'FitBH', top);

// Fit bounding box height
doc.addNamedDestination('BBOXV', 'FitBV', left);

// Specific position with zoom
doc.addNamedDestination('ZOOM', 'XYZ', left, top, zoom);
```

### Navigating to Destinations

**Using goTo annotation:**

```javascript
// Create clickable area
doc.goTo(10, 10, 100, 20, 'LINK', {
  color: 'blue'
});

// In text
doc.text('Go to section 2', 20, 0, {
  goTo: 'SECTION2',
  underline: true
});
```

**Using link with destination:**

```javascript
doc.text('Jump to end', {
  goTo: 'ENDP',
  underline: true,
  color: 'blue'
});
```

### Navigation Example

```javascript
// Create table of contents with navigation
doc.addPage();
doc.fontSize(18).text('Table of Contents', { underline: true });
doc.moveDown();

// TOC entries with navigation
doc.fontSize(12)
   .text('Chapter 1', { goTo: 'CHAPTER1', underline: true, color: 'blue' })
   .moveDown()
   .text('Chapter 2', { goTo: 'CHAPTER2', underline: true, color: 'blue' })
   .moveDown()
   .text('Chapter 3', { goTo: 'CHAPTER3', underline: true, color: 'blue' });

// Add chapters with destinations
doc.addPage();
doc.fontSize(20).text('Chapter 1', { destination: 'CHAPTER1' });
doc.fontSize(12).text('Chapter 1 content...');

doc.addPage();
doc.fontSize(20).text('Chapter 2', { destination: 'CHAPTER2' });
doc.fontSize(12).text('Chapter 2 content...');

doc.addPage();
doc.fontSize(20).text('Chapter 3', { destination: 'CHAPTER3' });
doc.fontSize(12).text('Chapter 3 content...');
```

---

## 📎 Attachments

Embed external files or attach files to specific locations in your PDF.

### Embedded Files

**From file path:**

```javascript
const path = require('path');

// Simple embed
doc.file(path.join(__dirname, 'example.txt'));

// With options
doc.file(path.join(__dirname, 'data.xlsx'), {
  name: 'Sales Data 2025.xlsx',
  description: 'Annual sales figures',
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  hidden: false,
  relationship: 'Data'  // 'Alternative', 'Data', 'Source', 'Supplement', 'Unspecified'
});
```

**From Buffer:**

```javascript
const fileBuffer = fs.readFileSync('document.pdf');

doc.file(fileBuffer, {
  name: 'attachment.pdf',
  type: 'application/pdf',
  description: 'Additional information'
});
```

**From text/string:**

```javascript
doc.file(Buffer.from('Hello, World!'), {
  name: 'greeting.txt',
  type: 'text/plain'
});
```

**From data URI:**

```javascript
// Type is automatically detected from data URI
doc.file('data:text/plain;base64,SGVsbG8gV29ybGQ=', {
  name: 'base64.txt'
});
```

### File Options

```javascript
doc.file('document.pdf', {
  name: 'Report.pdf',              // Display name
  type: 'application/pdf',         // MIME type
  description: 'Monthly report',   // Description text
  hidden: false,                   // Hide from attachment panel
  creationDate: new Date(),        // Override creation date
  modifiedDate: new Date(),        // Override modified date
  relationship: 'Supplement'       // Relationship type
});
```

### File Annotations

File annotations display as icons in the PDF, linking to embedded files.

```javascript
const fileObj = {
  src: path.join(__dirname, 'specs.pdf'),
  name: 'Technical Specifications.pdf',
  description: 'Detailed technical documentation',
  type: 'application/pdf'
};

// Add file annotation with icon
doc.fileAnnotation(100, 100, 100, 100, fileObj, {
  Name: 'Paperclip',  // 'GraphPush', 'Paperclip', 'Push'
  color: 'blue'
});
```

**File annotation icons:**

- `'Paperclip'` - Default paperclip icon
- `'GraphPush'` - Graph/chart icon
- `'Push'` - Push pin icon

### Complete Example

```javascript
// Embed supporting documents
doc.file('contract.pdf', {
  name: 'Original Contract.pdf',
  description: 'Signed contract document',
  relationship: 'Source'
});

doc.file('invoice.xlsx', {
  name: 'Invoice Details.xlsx',
  description: 'Itemized billing',
  relationship: 'Data'
});

// Add visible file annotation
const attachmentIcon = {
  src: 'appendix.pdf',
  name: 'Appendix A',
  description: 'Additional charts and graphs'
};

doc.text('See attached appendix for details:', 50, 100);
doc.fileAnnotation(50, 120, 50, 50, attachmentIcon, {
  Name: 'GraphPush',
  color: 'green'
});

// Hidden attachment (accessible via attachment panel only)
doc.file('metadata.json', {
  name: 'Document Metadata',
  hidden: true,
  relationship: 'Supplement'
});
```

---

## 📑 Outlines (Bookmarks)

Outlines create hierarchical bookmarks for easy navigation.

### Creating Outlines

```javascript
// Get outline root
const { outline } = doc;

// Add top-level bookmark
const chapter1 = outline.addItem('Chapter 1: Introduction');
const chapter2 = outline.addItem('Chapter 2: Getting Started');
const chapter3 = outline.addItem('Chapter 3: Advanced Topics');

// Add nested bookmarks
const section1_1 = chapter1.addItem('Section 1.1: Overview');
const section1_2 = chapter1.addItem('Section 1.2: Prerequisites');

chapter2.addItem('Section 2.1: Installation');
chapter2.addItem('Section 2.2: Configuration');
chapter2.addItem('Section 2.3: First Steps');

// Deep nesting
const subsection = section1_1.addItem('Subsection 1.1.1');
subsection.addItem('Topic A');
subsection.addItem('Topic B');
```

### Expanded Bookmarks

```javascript
// Expand bookmark by default (shows children)
const expandedChapter = outline.addItem('Important Chapter', {
  expanded: true
});

expandedChapter.addItem('Critical Section 1');
expandedChapter.addItem('Critical Section 2');

// Collapsed by default (default behavior)
const collapsedChapter = outline.addItem('Reference Chapter', {
  expanded: false  // or omit
});

collapsedChapter.addItem('Reference A');
collapsedChapter.addItem('Reference B');
```

### Complete Outline Example

```javascript
const doc = new PDFDocument();

// Get outline reference
const { outline } = doc;

// Cover page
doc.fontSize(24).text('Document Title', { align: 'center' });
doc.addPage();

// Chapter 1 with expanded sections
const ch1 = outline.addItem('1. Introduction', { expanded: true });
doc.fontSize(20).text('Chapter 1: Introduction');
doc.fontSize(12).text('Introduction content...');

doc.addPage();
ch1.addItem('1.1 Background');
doc.fontSize(16).text('1.1 Background');
doc.fontSize(12).text('Background information...');

doc.addPage();
ch1.addItem('1.2 Objectives');
doc.fontSize(16).text('1.2 Objectives');
doc.fontSize(12).text('Project objectives...');

// Chapter 2 (collapsed)
doc.addPage();
const ch2 = outline.addItem('2. Methodology');
doc.fontSize(20).text('Chapter 2: Methodology');
doc.fontSize(12).text('Methodology content...');

doc.addPage();
ch2.addItem('2.1 Approach');
doc.fontSize(16).text('2.1 Approach');

doc.addPage();
ch2.addItem('2.2 Tools');
doc.fontSize(16).text('2.2 Tools');

// Chapter 3 with deep nesting
doc.addPage();
const ch3 = outline.addItem('3. Results', { expanded: true });
doc.fontSize(20).text('Chapter 3: Results');

doc.addPage();
const sec3_1 = ch3.addItem('3.1 Findings');
doc.fontSize(16).text('3.1 Findings');

const subsec3_1_1 = sec3_1.addItem('3.1.1 Primary Results');
subsec3_1_1.addItem('Result A');
subsec3_1_1.addItem('Result B');

doc.end();
```

---

## ♿ Accessibility

Create accessible PDFs that work with screen readers and comply with PDF/UA standards.

### PDF/UA Compliance Checklist

```javascript
const doc = new PDFDocument({
  pdfVersion: '1.5',      // Required (or higher)
  subset: 'PDF/UA',       // Identify as PDF/UA-1
  tagged: true,           // Enable tagging
  displayTitle: true,     // Show title in viewer
  lang: 'en-US',          // Document language
  info: {
    Title: 'Accessible Document'  // Required
  }
});
```

**Requirements:**

- ✅ PDF version 1.5 or higher
- ✅ `subset: 'PDF/UA'` option set
- ✅ `tagged: true` for marked content
- ✅ `displayTitle: true` to show title
- ✅ Specify natural language
- ✅ Provide `Title` in metadata
- ✅ Include logical structure
- ✅ Mark all non-structure content as artifacts
- ✅ Include spaces between words
- ✅ Write in natural reading order
- ✅ Don't rely solely on visual cues
- ✅ No flickering/flashing content

### Marked Content

**Basic marking:**

```javascript
// Mark content as Span
doc.markContent('Span');
doc.text('Hello, world! ');
doc.endMarkedContent();
```

**Mark as artifact (non-structural content):**

```javascript
// Page decoration
doc.markContent('Artifact', { type: 'Layout' });
doc.rect(0, 0, doc.page.width, 50).fill('#f0f0f0');
doc.endMarkedContent();

// Header/footer
doc.markContent('Artifact', { 
  type: 'Pagination',
  attached: ['Top']  // 'Top', 'Bottom', 'Left', 'Right'
});
doc.text('Page Header', { align: 'center' });
doc.endMarkedContent();
```

**Marked content options:**

```javascript
// Language override
doc.markContent('Span', { lang: 'fr-FR' });
doc.text('Bonjour! ');
doc.endMarkedContent();

// Alternative text
doc.markContent('Span', { alt: 'Company logo' });
doc.image('logo.png', 50, 50, { width: 100 });
doc.endMarkedContent();

// Expanded form
doc.markContent('Span', { expanded: 'Portable Document Format' });
doc.text('PDF ');
doc.endMarkedContent();

// Actual text
doc.markContent('Span', { actual: 'Chapter 1' });
// Vector graphic representation of "Chapter 1"
doc.endMarkedContent();
```

### Logical Structure

**Simple structure:**

```javascript
// Mark structure content
const myParagraph = doc.markStructureContent('P');
doc.text('This is a paragraph. ');
doc.endMarkedContent();

// Add to document structure
doc.addStructure(doc.struct('P', myParagraph));
```

**Nested structure:**

```javascript
// Create section with nested elements
const section = doc.struct('Sect', [
  doc.struct('H', () => {
    doc.text('Section Title ');
  }),
  doc.struct('P', () => {
    doc.text('First paragraph. ');
  }),
  doc.struct('P', () => {
    doc.text('Second paragraph. ');
  })
]);

doc.addStructure(section);
```

**Incremental structure building:**

```javascript
// Create and add incrementally
const section = doc.struct('Sect');
doc.addStructure(section);

const heading = doc.struct('H', () => {
  doc.text('Chapter 1 ');
});
section.add(heading);

const para = doc.struct('P', () => {
  doc.text('Paragraph text. ');
});
section.add(para);

// End to flush (optional)
heading.end();
para.end();
section.end();
```

### Structure Element Options

```javascript
const section = doc.struct('Sect', {
  title: 'Chapter 1',                     // Section title
  lang: 'en-GB',                          // Override language
  alt: 'Diagram showing process flow',   // Alternative text
  expanded: 'United States of America',  // Expanded abbreviation
  actual: 'Chapter One'                   // Actual text
}, [
  // Child elements...
]);
```

### Automatic Structure for Text

**Using `structParent` option:**

```javascript
const section = doc.struct('Sect');
doc.addStructure(section);

// Automatically creates P elements
doc.text('First paragraph. \nSecond paragraph. ', {
  structParent: section
});

// Custom structure type
doc.text('Important Note ', {
  structParent: section,
  structType: 'Note'  // Instead of default 'P'
});
```

**Using `list()` method:**

```javascript
const section = doc.struct('Sect');
doc.addStructure(section);

// Create list structure
const list = doc.struct('L');
section.add(list);

// Automatically creates LI, Lbl, LBody elements
doc.list(['First item. ', 'Second item. ', 'Third item. '], {
  structParent: list
});

// Custom structure types
doc.list(['Item A', 'Item B'], {
  structParent: list,
  structTypes: ['LI', 'Lbl', 'LBody']  // [itemType, labelType, bodyType]
});

// Collapse label and body
doc.list(['Item 1', 'Item 2'], {
  structParent: list,
  structTypes: ['LI', null, null]  // No separate Lbl/LBody
});
```

### Structure Element Types

**Grouping elements:**
- `Document` - Whole document
- `Part` - Document part
- `Art` - Article
- `Sect` - Section (nestable)
- `Div` - Generic division
- `BlockQuote` - Block quotation
- `Caption` - Figure/table caption
- `TOC` - Table of contents
- `TOCI` - TOC item
- `Index` - Index
- `NonStruct` - Non-structural grouping
- `Private` - Creator-specific content

**Block elements:**
- `H` - Heading
- `H1` to `H6` - Specific heading levels
- `P` - Paragraph
- `L` - List
- `LI` - List item
- `Lbl` - Label (bullet/number)
- `LBody` - List body

**Table elements:**
- `Table` - Table
- `TR` - Table row
- `TH` - Table header cell
- `TD` - Table data cell
- `THead` - Table header group
- `TBody` - Table body group
- `TFoot` - Table footer group

**Inline elements:**
- `Span` - Generic inline
- `Quote` - Inline quotation
- `Note` - Footnote
- `Reference` - Cross-reference
- `BibEntry` - Bibliography entry
- `Code` - Code snippet
- `Link` - Hyperlink
- `Annot` - Annotation
- `Ruby`, `RB`, `RT`, `RP` - Asian pronunciation
- `Warichu`, `WT`, `WP` - Asian description

**Illustration elements:**
- `Figure` - Figure/image
- `Formula` - Mathematical formula
- `Form` - Form widget

### Complete Accessible Example

```javascript
const doc = new PDFDocument({
  pdfVersion: '1.5',
  subset: 'PDF/UA',
  tagged: true,
  displayTitle: true,
  lang: 'en-US',
  info: {
    Title: 'Accessible Report',
    Author: 'John Doe'
  }
});

doc.pipe(fs.createWriteStream('accessible.pdf'));

// Page decoration (artifact)
doc.markContent('Artifact', { type: 'Layout' });
doc.rect(0, 0, doc.page.width, 50).fill('#3498db');
doc.endMarkedContent();

// Main content structure
const document = doc.struct('Document');
doc.addStructure(document);

// Title section
const titleSect = doc.struct('Sect', { title: 'Title Page' });
document.add(titleSect);

const mainHeading = doc.struct('H', () => {
  doc.fillColor('white')
     .fontSize(24)
     .text('Accessible Report ', 50, 15, { align: 'center' });
});
titleSect.add(mainHeading);

// Content section
doc.addPage();
const contentSect = doc.struct('Sect', { title: 'Introduction' });
document.add(contentSect);

// Heading
const h1 = doc.struct('H1', () => {
  doc.fillColor('black')
     .fontSize(20)
     .text('Introduction ', 50, 50);
});
contentSect.add(h1);

// Paragraphs
doc.fillColor('black').fontSize(12).moveDown();
doc.text('First paragraph with proper spacing. \nSecond paragraph here. ', {
  structParent: contentSect,
  width: 500
});

// Image with alt text
const figure = doc.struct('Figure', {
  alt: 'Bar chart showing quarterly sales growth'
});
contentSect.add(figure);

const figContent = doc.markStructureContent('Figure');
doc.image('chart.png', 50, doc.y + 10, { width: 400 });
doc.endMarkedContent();
figure.add(figContent);
figure.end();

// List
const list = doc.struct('L');
contentSect.add(list);
doc.moveDown(2);
doc.list(['Key finding one. ', 'Key finding two. ', 'Key finding three. '], {
  structParent: list
});
list.end();

// Footer (artifact)
doc.markContent('Artifact', { 
  type: 'Pagination',
  attached: ['Bottom']
});
doc.fontSize(8)
   .text('Page 1', 0, doc.page.height - 30, {
     align: 'center',
     width: doc.page.width
   });
doc.endMarkedContent();

// End structure
contentSect.end();
titleSect.end();
document.end();

doc.end();
```

---

## 🎯 Advanced Features

### Document Metadata

```javascript
// Set at creation
const doc = new PDFDocument({
  info: {
    Title: 'My Document',
    Author: 'John Doe',
    Subject: 'Example PDF',
    Keywords: 'pdf, example, test',
    CreationDate: new Date(),
    ModDate: new Date()
  }
});

// Or set later
doc.info.Title = 'Updated Title';
doc.info.Author = 'Jane Smith';
```

### Encryption and Passwords

```javascript
const doc = new PDFDocument({
  userPassword: 'user123',    // Password to open document
  ownerPassword: 'owner456',  // Password for full access
  
  permissions: {
    printing: 'highResolution',  // 'lowResolution', 'highResolution', or false
    modifying: false,
    copying: true,
    annotating: true,
    fillingForms: true,
    contentAccessibility: true,
    documentAssembly: true
  },
  
  pdfVersion: '1.7'  // For 128-bit AES encryption
});
```

**Encryption Methods by PDF Version:**
- `1.3` - 40-bit RC4
- `1.4` - 128-bit RC4
- `1.5` - 128-bit RC4
- `1.6` - 128-bit AES
- `1.7` - 128-bit AES
- `1.7ext3` - 256-bit AES

### PDF/A Archival Format

```javascript
const doc = new PDFDocument({
  subset: 'PDF/A-1b',    // Level B (basic) conformance
  // Or: 'PDF/A-1a',     // Level A (accessible)
  // Or: 'PDF/A-2b', 'PDF/A-2a', 'PDF/A-3b', 'PDF/A-3a'
  
  pdfVersion: '1.7',     // Required for PDF/A-2 and PDF/A-3
  tagged: true           // Required for level A
});

// Must use embedded fonts (not standard PDF fonts)
doc.registerFont('CustomFont', 'fonts/Arial.ttf');
doc.font('CustomFont').text('PDF/A compliant text');
```

**PDF/A Restrictions:**
- ❌ Cannot be encrypted
- ✅ Fonts must be embedded
- ❌ No JavaScript
- ❌ No audio/video
- ✅ XMP metadata required
- ✅ Color spaces must be defined

### Outlines (Bookmarks)

```javascript
// Get outline root
const { outline } = doc;

// Add top-level bookmark
const chapter1 = outline.addItem('Chapter 1');
const chapter2 = outline.addItem('Chapter 2');

// Add nested bookmarks
chapter1.addItem('Section 1.1');
chapter1.addItem('Section 1.2');

// Expanded by default
const chapter3 = outline.addItem('Chapter 3', { expanded: true });
chapter3.addItem('Section 3.1');
```

### Annotations and Links

### Custom Page Numbering

```javascript
const doc = new PDFDocument({ bufferPages: true });

// Add content...
doc.addPage();
doc.text('Page 1');
doc.addPage();
doc.text('Page 2');

// Add page numbers at the end
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(i);
  doc.text(
    `Page ${i + 1} of ${range.count}`,
    0,
    doc.page.height - 50,
    { align: 'center' }
  );
}

doc.end();
```

---

## ✨ Best Practices

### 1. **Memory Management**

```javascript
// ✅ Good: Stream output immediately
doc.pipe(fs.createWriteStream('output.pdf'));
doc.text('Content');
doc.end();

// ❌ Bad: Buffering entire PDF in memory
const chunks = [];
doc.on('data', chunk => chunks.push(chunk));
doc.on('end', () => {
  const pdfBuffer = Buffer.concat(chunks); // Memory intensive
});
```

### 2. **Error Handling**

```javascript
const writeStream = fs.createWriteStream('output.pdf');

doc.pipe(writeStream);

writeStream.on('error', (err) => {
  console.error('Error writing PDF:', err);
});

writeStream.on('finish', () => {
  console.log('PDF written successfully');
});

doc.end();
```

### 3. **Font Limitations**

```javascript
// ❌ Don't use standard fonts for Unicode
doc.font('Helvetica').text('💵 Emoji'); // Won't render

// ✅ Use TrueType fonts for Unicode
doc.registerFont('Unicode', 'fonts/NotoEmoji-Regular.ttf');
doc.font('Unicode').text('💵 Emoji'); // Renders correctly

// ✅ Or use plain text
doc.font('Helvetica').text('MONEY RECEIVED'); // Simple and effective
```

### 4. **Page Breaks**

```javascript
// Check if content fits on current page
const contentHeight = doc.heightOfString(text, { width: 400 });

if (doc.y + contentHeight > doc.page.height - doc.page.margins.bottom) {
  doc.addPage();
}

doc.text(text, { width: 400 });
```

### 5. **Graphics State Management**

```javascript
// Always save/restore when making temporary changes
doc.save();
doc.fillColor('red');
doc.rotate(45);
doc.rect(0, 0, 100, 100).fill();
doc.restore();

// Back to original state
doc.rect(150, 0, 100, 100).fill(); // Uses original color
```

### 6. **Performance Tips**

```javascript
// ✅ Reuse fonts
doc.registerFont('Body', 'fonts/Arial.ttf');
doc.font('Body'); // Fast lookup

// ✅ Minimize font switches
doc.font('Helvetica'); // Set once
doc.text('Line 1');
doc.text('Line 2');
doc.text('Line 3');

// ❌ Avoid repeated font switching
doc.font('Helvetica').text('Line 1');
doc.font('Helvetica').text('Line 2'); // Redundant
```

### 7. **Layout Consistency**

```javascript
// Define reusable constants
const MARGIN = 50;
const PAGE_WIDTH = 595.28;  // A4 width
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const COLORS = {
  primary: '#2c3e50',
  secondary: '#3498db',
  success: '#27ae60',
  danger: '#e74c3c'
};

// Use throughout document
doc.fillColor(COLORS.primary)
   .text('Heading', MARGIN, MARGIN, { width: CONTENT_WIDTH });
```

### 8. **Testing PDFs**

```javascript
// Add visible debug markers
if (DEBUG_MODE) {
  doc.rect(doc.x, doc.y, 100, 100).stroke(); // Show text box
  doc.text(`X: ${doc.x}, Y: ${doc.y}`, { align: 'right' }); // Show position
}
```

---

## 🎓 Real-World Examples

### Example 1: Professional Invoice

```javascript
const PDFDocument = require('pdfkit');
const fs = require('fs');

function generateInvoice(invoiceData) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const filePath = `invoice-${invoiceData.invoiceNumber}.pdf`;
  
  doc.pipe(fs.createWriteStream(filePath));
  
  // Company Header
  doc.fillColor('#2c3e50')
     .fontSize(24)
     .font('Helvetica-Bold')
     .text('ACME Corporation', 50, 50);
  
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#7f8c8d')
     .text('123 Business St, City, State 12345', 50, 80)
     .text('Phone: (555) 123-4567', 50, 95)
     .text('Email: billing@acme.com', 50, 110);
  
  // Invoice Info Box
  doc.rect(350, 50, 195, 80).fill('#ecf0f1');
  doc.rect(350, 50, 195, 80).stroke('#95a5a6');
  
  doc.fillColor('#2c3e50')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('INVOICE', 360, 60);
  
  doc.fontSize(9)
     .font('Helvetica')
     .text(`Number: ${invoiceData.invoiceNumber}`, 360, 80)
     .text(`Date: ${invoiceData.date}`, 360, 95)
     .text(`Due: ${invoiceData.dueDate}`, 360, 110);
  
  // Bill To
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor('#2c3e50')
     .text('Bill To:', 50, 150);
  
  doc.fontSize(10)
     .font('Helvetica')
     .text(invoiceData.customer.name, 50, 170)
     .text(invoiceData.customer.address, 50, 185)
     .text(invoiceData.customer.city, 50, 200);
  
  // Items Table
  const tableTop = 250;
  
  // Table Header
  doc.rect(50, tableTop, 495, 25).fill('#34495e');
  doc.fillColor('#ffffff')
     .fontSize(10)
     .font('Helvetica-Bold')
     .text('Description', 60, tableTop + 8, { width: 200 })
     .text('Qty', 270, tableTop + 8, { width: 50, align: 'right' })
     .text('Price', 330, tableTop + 8, { width: 80, align: 'right' })
     .text('Total', 420, tableTop + 8, { width: 115, align: 'right' });
  
  // Table Rows
  let yPos = tableTop + 35;
  let subtotal = 0;
  
  invoiceData.items.forEach((item, index) => {
    const total = item.quantity * item.price;
    subtotal += total;
    
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    doc.rect(50, yPos - 5, 495, 25).fill(bgColor);
    
    doc.fillColor('#2c3e50')
       .fontSize(9)
       .font('Helvetica')
       .text(item.description, 60, yPos, { width: 200 })
       .text(item.quantity.toString(), 270, yPos, { width: 50, align: 'right' })
       .text(`$${item.price.toFixed(2)}`, 330, yPos, { width: 80, align: 'right' })
       .text(`$${total.toFixed(2)}`, 420, yPos, { width: 115, align: 'right' });
    
    yPos += 25;
  });
  
  // Totals
  yPos += 10;
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;
  
  doc.fontSize(10)
     .font('Helvetica')
     .text('Subtotal:', 370, yPos, { width: 100, align: 'right' })
     .text(`$${subtotal.toFixed(2)}`, 480, yPos, { width: 65, align: 'right' });
  
  yPos += 20;
  doc.text('Tax (10%):', 370, yPos, { width: 100, align: 'right' })
     .text(`$${tax.toFixed(2)}`, 480, yPos, { width: 65, align: 'right' });
  
  yPos += 20;
  doc.rect(370, yPos - 5, 175, 25).fill('#34495e');
  doc.fillColor('#ffffff')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('Total:', 380, yPos + 3, { width: 100, align: 'right' })
     .text(`$${total.toFixed(2)}`, 490, yPos + 3, { width: 65, align: 'right' });
  
  // Footer
  doc.fillColor('#7f8c8d')
     .fontSize(8)
     .font('Helvetica')
     .text('Thank you for your business!', 50, 700, { align: 'center', width: 495 })
     .text('Payment is due within 30 days', 50, 715, { align: 'center', width: 495 });
  
  doc.end();
  
  return filePath;
}

// Usage
const invoice = {
  invoiceNumber: 'INV-001',
  date: '2025-10-28',
  dueDate: '2025-11-28',
  customer: {
    name: 'John Doe',
    address: '456 Client Ave',
    city: 'Cityville, ST 67890'
  },
  items: [
    { description: 'Website Development', quantity: 1, price: 5000 },
    { description: 'Logo Design', quantity: 1, price: 500 },
    { description: 'Business Cards', quantity: 500, price: 0.50 }
  ]
};

generateInvoice(invoice);
```

### Example 2: Report with Charts (Using Images)

```javascript
async function generateReport(data) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(fs.createWriteStream('report.pdf'));
  
  // Cover Page
  doc.rect(0, 0, doc.page.width, 200).fill('#3498db');
  doc.fillColor('#ffffff')
     .fontSize(36)
     .font('Helvetica-Bold')
     .text('Annual Report 2024', 0, 80, { align: 'center', width: doc.page.width });
  
  doc.fontSize(18)
     .text('Company Performance Overview', 0, 130, { align: 'center', width: doc.page.width });
  
  // Add new page for content
  doc.addPage();
  
  // Executive Summary
  doc.fillColor('#2c3e50')
     .fontSize(20)
     .font('Helvetica-Bold')
     .text('Executive Summary', 50, 50);
  
  doc.fontSize(11)
     .font('Helvetica')
     .text(data.summary, 50, 80, { width: 495, align: 'justify', lineGap: 3 });
  
  doc.moveDown(2);
  
  // Key Metrics Table
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text('Key Metrics', 50, doc.y);
  
  doc.moveDown();
  
  doc.table({
    columnStyles: ['*', '*', '*'],
    rowStyles: (i) => i === 0 ? { backgroundColor: '#34495e', textColor: '#ffffff' } : {},
    data: [
      ['Metric', '2023', '2024'],
      ['Revenue', `$${data.revenue2023}M`, `$${data.revenue2024}M`],
      ['Profit', `$${data.profit2023}M`, `$${data.profit2024}M`],
      ['Employees', data.employees2023, data.employees2024]
    ]
  });
  
  // Add chart image (assuming you generated it with a charting library)
  doc.addPage();
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .text('Revenue Trend', 50, 50);
  
  if (fs.existsSync('chart.png')) {
    doc.image('chart.png', 50, 80, { width: 495 });
  }
  
  doc.end();
}
```

### Example 3: Business Card

```javascript
function generateBusinessCard(person) {
  // Business card size: 3.5" x 2" = 252pt x 144pt
  const doc = new PDFDocument({
    size: [252, 144],
    margin: 0
  });
  
  doc.pipe(fs.createWriteStream(`card-${person.name.replace(' ', '-')}.pdf`));
  
  // Background gradient
  const grad = doc.linearGradient(0, 0, 252, 144);
  grad.stop(0, '#667eea')
      .stop(1, '#764ba2');
  doc.rect(0, 0, 252, 144).fill(grad);
  
  // Company logo area
  doc.save();
  doc.fillColor('#ffffff', 0.2);
  doc.circle(220, 30, 40).fill();
  doc.restore();
  
  // Name
  doc.fillColor('#ffffff')
     .fontSize(16)
     .font('Helvetica-Bold')
     .text(person.name, 20, 30);
  
  // Title
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#ffffff', 0.8)
     .text(person.title, 20, 52);
  
  // Contact Info
  doc.fontSize(8)
     .text(person.email, 20, 80)
     .text(person.phone, 20, 95)
     .text(person.website, 20, 110);
  
  doc.end();
}
```

### Example 4: Certificate

```javascript
function generateCertificate(recipient) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 50
  });
  
  doc.pipe(fs.createWriteStream(`certificate-${recipient.id}.pdf`));
  
  // Border
  doc.lineWidth(10)
     .strokeColor('#c0392b')
     .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
     .stroke();
  
  doc.lineWidth(5)
     .strokeColor('#e74c3c')
     .rect(40, 40, doc.page.width - 80, doc.page.height - 80)
     .stroke();
  
  // Title
  doc.fillColor('#2c3e50')
     .fontSize(48)
     .font('Helvetica-Bold')
     .text('CERTIFICATE', 0, 100, { align: 'center', width: doc.page.width });
  
  doc.fontSize(18)
     .font('Helvetica')
     .text('OF ACHIEVEMENT', 0, 160, { align: 'center', width: doc.page.width });
  
  // Recipient
  doc.fontSize(14)
     .text('This is to certify that', 0, 220, { align: 'center', width: doc.page.width });
  
  doc.fontSize(32)
     .font('Helvetica-Bold')
     .fillColor('#e74c3c')
     .text(recipient.name, 0, 250, { align: 'center', width: doc.page.width });
  
  // Description
  doc.fontSize(14)
     .font('Helvetica')
     .fillColor('#2c3e50')
     .text(`has successfully completed the ${recipient.course}`, 0, 300, {
       align: 'center',
       width: doc.page.width
     });
  
  doc.text(`on ${recipient.date}`, 0, 330, {
    align: 'center',
    width: doc.page.width
  });
  
  // Signature
  doc.fontSize(10)
     .text('_____________________', 200, 420);
  doc.text('Instructor Signature', 200, 440);
  
  doc.text('_____________________', 500, 420);
  doc.text('Date', 500, 440);
  
  doc.end();
}
```

---

## 🔗 Additional Resources

- **Official Documentation:** https://pdfkit.org/docs/
- **GitHub Repository:** https://github.com/foliojs/pdfkit
- **PDF Specification:** https://www.adobe.com/devnet/pdf/pdf_reference.html
- **PDF/A Standard:** https://www.pdfa.org/
- **Accessibility (PDF/UA):** https://www.pdfa.org/pdf-ua-universal-accessibility/

---

## 📌 Quick Reference Card

```javascript
// Document
const doc = new PDFDocument(options);
doc.pipe(stream);
doc.end();

// Pages
doc.addPage({ size: 'A4', layout: 'landscape', margin: 50 });
doc.switchToPage(0);

// Text
doc.font('Helvetica-Bold')
   .fontSize(14)
   .fillColor('black')
   .text('Text', x, y, options);

// Shapes
doc.rect(x, y, w, h).fill();
doc.circle(x, y, r).stroke();
doc.path('M 0,0 L 100,100').fill();

// Images
doc.image('path.jpg', x, y, { width: 200 });

// Tables
doc.table({ data: [[/*...*/]] });

// State
doc.save();
doc.restore();

// Transforms
doc.translate(x, y);
doc.rotate(degrees);
doc.scale(factor);
```

---

## 💡 Pro Tips

1. **Always use `save()` and `restore()`** when making temporary style changes
2. **Check `doc.y` position** before adding content to prevent page overflow
3. **Use method chaining** for cleaner code: `doc.font('Helvetica').fontSize(12).text('Hello')`
4. **Register fonts** at the start of your document generation
5. **Use constants** for colors, margins, and widths for consistency
6. **Test with different PDF readers** (Adobe, Chrome, Firefox, mobile viewers)
7. **Implement error handling** for file operations and font loading
8. **Consider file size** - large images and embedded fonts increase PDF size
9. **Use streaming** for large PDFs to avoid memory issues
10. **Validate PDF/A compliance** if archiving is required using veraPDF

---

## 🎉 Conclusion

PDFKit is a powerful library for creating PDFs in Node.js with:
- ✅ Complete control over layout and styling
- ✅ Vector graphics support
- ✅ Rich text formatting
- ✅ Table generation
- ✅ Image embedding
- ✅ Accessibility features
- ✅ Encryption and security
- ✅ PDF/A archival support

**Start creating awesome PDFs today!** 🚀

---

*Generated: October 28, 2025 | PDFKit Documentation Guide | Version 1.0*
