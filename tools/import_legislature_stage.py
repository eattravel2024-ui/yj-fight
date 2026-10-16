#!/usr/bin/env python3
"""Import the user's real legislature PNG; no borrowed/generated background is substituted."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
from PIL import Image, ImageOps, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/source-art/phase4/stages/立法院議場對決舞台.png'
TARGET = ROOT / 'public/art/stages/legislature'
VISUALS = {'saturation': .77, 'brightness': .85, 'contrast': .91, 'coolTint': .025}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def atomic(path, raw):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.stage-')
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(raw)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def build(source):
    if not source.is_file():
        raise ValueError(f'找不到原始 PNG：{source}；立法院保持停用，不使用替代圖片。')
    raw = source.read_bytes()
    with Image.open(source) as supplied:
        if supplied.format != 'PNG':
            raise ValueError('原始檔必須為 PNG；不以改副檔名冒充。')
        supplied.load()
        image = ImageOps.exif_transpose(supplied).convert('RGBA')
    if image.width < 960 or image.height < 540 or abs(image.width / image.height - 16 / 9) > .035:
        raise ValueError('需要至少 960×540、接近 16:9 的完整場景；不拉伸或裁掉舞台。')
    if image.getchannel('A').getextrema()[1] < 200:
        raise ValueError('場景整體透明度過高，請提供可用的原始舞台。')
    if SOURCE.exists() and SOURCE.read_bytes() != raw:
        raise ValueError('原始素材目錄已存在不同檔案；請先保存並檢查版本，不覆寫原圖。')
    base = Image.new('RGBA', image.size, '#101522')
    base.alpha_composite(image)
    combat = ImageEnhance.Color(base.convert('RGB')).enhance(VISUALS['saturation'])
    combat = ImageEnhance.Brightness(combat).enhance(VISUALS['brightness'])
    combat = ImageEnhance.Contrast(combat).enhance(VISUALS['contrast'])
    combat = Image.blend(combat, Image.new('RGB', combat.size, '#152b46'), VISUALS['coolTint'])
    import io
    outputs = {}
    for role, art in [('background', image), ('preview', ImageOps.contain(image, (640, 360), Image.Resampling.LANCZOS)), ('combat', combat)]:
        buffer = io.BytesIO()
        art.save(buffer, 'WEBP', quality=91 if role == 'combat' else 92, alpha_quality=100, method=6, exact=True)
        data = buffer.getvalue()
        outputs[role] = {'path': f'art/stages/legislature/{role}.webp', 'width': art.width, 'height': art.height, 'bytes': len(data), 'sha256': sha(data)}
        atomic(TARGET / f'{role}.webp', data)
    if not SOURCE.exists():
        atomic(SOURCE, raw)
    manifest = {'id': 'legislature', 'name': '立法院', 'ready': True, 'layers': 1,
                'source': {'path': str(SOURCE.relative_to(ROOT)), 'sha256': sha(raw), 'bytes': len(raw), 'width': image.width, 'height': image.height},
                'assets': outputs, 'visuals': VISUALS, 'geometry': {'width': 960, 'height': 540, 'groundY': 448, 'spawns': [274, 686]},
                'musicNote': '暫用現有原創 stage_fur_lab；未提供立法院專屬曲目。'}
    atomic(TARGET / 'manifest.json', (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode())
    status = {'ready': True, 'sourceExpected': str(SOURCE.relative_to(ROOT)), 'sourceSha256': sha(raw), 'width': image.width, 'height': image.height}
    js = "/* Generated only from validated user-supplied art. */\n(function(root){'use strict';const api=Object.freeze({legislature:Object.freeze(" + json.dumps(status, ensure_ascii=False) + ")});if(typeof module==='object'&&module.exports)module.exports=api;root.AzhiStageAssets=api;})(globalThis);\n"
    # Enable only after all runtime files and the original are present.
    atomic(ROOT / 'public/stage-assets.js', js.encode())
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', nargs='?', type=Path, default=SOURCE)
    args = parser.parse_args()
    try:
        build(args.source.resolve())
    except (ValueError, OSError) as error:
        parser.exit(2, str(error) + '\n')
