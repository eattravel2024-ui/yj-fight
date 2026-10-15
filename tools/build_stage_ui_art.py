#!/usr/bin/env python3
"""Prepare supplied stage art for future UI use; never alter live stage loading."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
STAGES = {'night-market': ('嘴砲夜市', '夜市地圖.png'),
          'golden-casino': ('金沙賭城', '賭城地圖.png'),
          'tiananmen-square': ('天安門廣場', '天安門地圖.png')}


def describe(path):
    raw = path.read_bytes()
    with Image.open(path) as im:
        alpha = im.getchannel('A') if 'A' in im.getbands() else None
        return {'path': str(path.relative_to(ROOT)), 'width': im.width, 'height': im.height,
                'format': im.format, 'mode': im.mode, 'bytes': len(raw),
                'sha256': hashlib.sha256(raw).hexdigest(),
                'alphaRange': list(alpha.getextrema()) if alpha is not None else None}


def build():
    manifest = {'sourceArchive': 'User-provided 場景圖.zip',
                'purpose': 'Prepared art only; IDs are asset IDs, not live engine stage IDs',
                'processing': 'No crop, stretch or flatten; fullsize WebP and proportional <=640x360 preview; quality 92, alpha 100',
                'stages': {}}
    for asset_id, (name, filename) in STAGES.items():
        source = ROOT / 'assets/source-art/phase1_5/stages' / filename
        with Image.open(source) as image:
            image.load()
            target_dir = ROOT / 'public/art/stages' / asset_id
            target_dir.mkdir(parents=True, exist_ok=True)
            outputs = {}
            for role, output in [('background', image), ('preview', ImageOps.contain(image, (640, 360), Image.Resampling.LANCZOS))]:
                target = target_dir / f'{role}.webp'
                output.save(target, 'WEBP', quality=92, alpha_quality=100, method=6, exact=True)
                outputs[role] = describe(target)
        manifest['stages'][asset_id] = {'name': name, 'source': describe(source), 'assets': outputs,
            'note': 'Source is semi-transparent (alpha 101–250); preserved, review compositing in Phase 3.' if asset_id == 'night-market' else 'Opaque source.'}
    target = ROOT / 'assets/source-art/phase1_5/stages-manifest.json'
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
