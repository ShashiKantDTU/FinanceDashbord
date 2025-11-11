# Font Files for PDF Reports

## Required Font for Hindi/Devanagari Support

To enable Hindi (Devanagari) text rendering in PDF reports, you need to download the Noto Sans Devanagari font.

### Download Instructions:

**Option 1: Direct Download**
1. Visit: https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari
2. Click "Download family"
3. Extract the ZIP file
4. Copy `NotoSansDevanagari-Regular.ttf` from the `static` folder
5. Place it in this `fonts` directory

**Option 2: GitHub Direct Link**
1. Visit: https://github.com/notofonts/devanagari/tree/main/fonts/NotoSansDevanagari/unhinted/ttf
2. Download `NotoSansDevanagari-Regular.ttf`
3. Place it in this `fonts` directory

**Option 3: Using npm package**
```bash
npm install @fontsource/noto-sans-devanagari
```
Then copy the .ttf file from `node_modules/@fontsource/noto-sans-devanagari/files/` to this directory.

### File Location:
The file should be placed at:
```
Backend/fonts/NotoSansDevanagari-Regular.ttf
```

### Verification:
Once the font file is in place, the PDF generator will automatically use it for rendering Hindi text.
