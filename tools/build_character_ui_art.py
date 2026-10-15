#!/usr/bin/env python3
"""Package user-supplied UI art without redrawing, stretching, or changing combat atlases.

Pillow is an authoring dependency only. Originals are never overwritten. All
source pixels are retained through proportional contain + transparent padding.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source-art/phase1_5/characters'
OUTPUT = ROOT / 'public/art/characters'
CHARACTERS = {'winnie': '維尼', 'sezi': '塞子', 'gambler': '金沙賭神', 'azhi': '阿志'}
ROLES = {'fullbody': ('立體繪', (768, 1024), 24), 'portrait': ('肖像圖', (512, 512), 16), 'hud': ('HUD', (256, 256), 8)}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def alpha_info(image):
    alpha = image.getchannel('A')
    histogram = alpha.histogram()
    area = image.width * image.height
    return {'alphaRange': list(alpha.getextrema()),
            'transparentFraction': round(histogram[0] / area, 6),
            'boundsAbove16': alpha.point(lambda a: 255 if a > 16 else 0).getbbox()}


def build():
    manifest = {'sourceArchive': 'User-provided 人物圖.zip', 'purpose': 'UI only; never combat sprites',
                'processing': 'No crop/redraw; proportional Lanczos contain, transparent padding, WebP quality 92/alpha 100',
                'characters': {}}
    for character_id, name in CHARACTERS.items():
        roles = {}
        for role, (suffix, size, padding) in ROLES.items():
            source = SOURCE / character_id / f'{name}{suffix}.png'
            raw = source.read_bytes()
            image = Image.open(source)
            if image.mode != 'RGBA' or image.getchannel('A').getextrema()[0] != 0:
                raise ValueError(f'Expected supplied transparent RGBA image: {source}')
            source_info = {'path': str(source.relative_to(ROOT)), 'originalFilename': source.name,
                           'width': image.width, 'height': image.height, 'format': image.format,
                           'bytes': len(raw), 'sha256': digest(raw), **alpha_info(image)}
            contained = ImageOps.contain(image, (size[0] - padding * 2, size[1] - padding * 2), Image.Resampling.LANCZOS)
            output = Image.new('RGBA', size)
            position = ((size[0] - contained.width) // 2, (size[1] - contained.height) // 2)
            output.alpha_composite(contained, position)
            target = OUTPUT / character_id / f'{role}.webp'
            target.parent.mkdir(parents=True, exist_ok=True)
            output.save(target, 'WEBP', quality=92, alpha_quality=100, method=6, exact=True)
            encoded = target.read_bytes()
            decoded = Image.open(target).convert('RGBA')
            if decoded.getchannel('A').getextrema()[0] != 0:
                raise ValueError('Transparency was lost')
            roles[role] = {'source': source_info, 'output': {'path': str(target.relative_to(ROOT)),
                           'width': size[0], 'height': size[1], 'bytes': len(encoded), 'sha256': digest(encoded),
                           'format': 'WEBP', 'mode': 'RGBA', 'containedSize': list(contained.size),
                           'offset': list(position), **alpha_info(decoded)}}
        manifest['characters'][character_id] = {'name': name, 'assets': roles}
    path = ROOT / 'assets/source-art/phase1_5/manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('UI art manifest:', path)
    print('Original bytes:', sum(a['source']['bytes'] for c in manifest['characters'].values() for a in c['assets'].values()))
    print('WebP bytes:', sum(a['output']['bytes'] for c in manifest['characters'].values() for a in c['assets'].values()))


if __name__ == '__main__':
    build()
