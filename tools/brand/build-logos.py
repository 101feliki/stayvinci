# Builds bold, transparent theme variants of the Figma logo export.
# Usage: python tools/brand/build-logos.py brand/logo
# Then copy brand/logo/stayvinci-{logo,mark}-on-{dark,light}.svg into apps/*/public/brand/.
import re, sys, os
brand = sys.argv[1]
src = open(os.path.join(brand, 'stayvinci-logo-figma.svg'), encoding='utf-8').read()

# Transparent background.
base = re.sub(r'<rect width="1848" height="672" fill="#1E1E1E"/>\n?', '', src)

def embolden(svg):
    # Letters of the wordmark (paint4..12) and the S, V and star of the mark (paint1..3):
    # trace each glyph with its own gradient so it gets visibly heavier.
    def glyph(m):
        n = int(m.group(1))
        width = 7 if n >= 4 else 6
        return f'fill="url(#paint{n}_linear_0_1)" stroke="url(#paint{n}_linear_0_1)" stroke-width="{width}" stroke-linejoin="round"'
    svg = re.sub(r'fill="url\(#paint(\d+)_linear_0_1\)"', glyph, svg)
    # The ring and divider lines.
    svg = svg.replace('stroke-width="12" stroke="url(#paint0_linear_0_1)"', 'stroke-width="17" stroke="url(#paint0_linear_0_1)"')
    svg = svg.replace('<path d="M698 96V576" stroke-width="3"', '<path d="M698 96V576" stroke-width="5"')
    # Tagline: a touch heavier so it survives small sizes.
    svg = svg.replace('Z" fill="#DDBD76"/>', 'Z" fill="#DDBD76" stroke="#DDBD76" stroke-width="1.8" stroke-linejoin="round"/>')
    return svg

on_dark = embolden(base)
on_light = embolden(
    base.replace('stop-color="white"', 'stop-color="#1C1C1E"')
    .replace('stroke="white"', 'stroke="#1C1C1E"')
    .replace('#DDBD76', '#8C6A2C')
)

def view(svg, vb, w, h):
    return svg.replace('width="1848" height="672" viewBox="0 0 1848 672"', f'width="{w}" height="{h}" viewBox="{vb}"', 1)

out = {
    'stayvinci-logo-on-dark.svg': view(on_dark, '84 80 1688 512', 1688, 512),
    'stayvinci-logo-on-light.svg': view(on_light, '84 80 1688 512', 1688, 512),
    'stayvinci-mark-on-dark.svg': view(on_dark, '88 84 504 504', 504, 504),
    'stayvinci-mark-on-light.svg': view(on_light, '88 84 504 504', 504, 504),
}
for name, svg in out.items():
    open(os.path.join(brand, name), 'w', encoding='utf-8').write(svg)
    print('wrote', name)
