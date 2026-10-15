#!/usr/bin/env python3
"""Pack the image-generated, reference-based fighter poses into the runtime atlas.

Art editing is performed with image generation; this script only isolates supplied
pose components, normalizes their anchors and packs the existing 17 x 10 format.
Requires Pillow (authoring only); the game has no Python/runtime dependency.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]


def build(output=None, fighter='azhi'):
    if fighter not in ('azhi', 'gambler', 'winnie', 'sezi'):
        raise ValueError('Unsupported reference fighter')
    profile_path = ROOT / 'assets' / fighter / ('reference-poses.json' if fighter in ('winnie', 'sezi') else 'video-poses.json')
    profile = json.loads(profile_path.read_text())
    source = Image.open(profile_path.parent / profile['sourceSheet']).convert('RGBA')
    width, height = profile['frameWidth'], profile['frameHeight']
    scale, baseline = profile['scale'], profile['baseline']
    poses = []
    for pose in profile['poses']:
        left, top, right, bottom = pose['rect']
        # The supplied atlas has slight bounding-box overlaps. Select the named
        # connected alpha component so a neighbour's hand never enters a frame.
        bounds = (max(0, left-3), max(0, top-3), min(source.width, right+3), min(source.height, bottom+3))
        image = source.crop(bounds)
        alpha = image.getchannel('A')
        mask = alpha.point(lambda a: 255 if a > 24 else 0)
        seed = (pose['seed'][0]-bounds[0], pose['seed'][1]-bounds[1])
        ImageDraw.floodfill(mask, seed, 128)
        mask = mask.point(lambda a: 255 if a == 128 else 0).filter(ImageFilter.MaxFilter(3))
        image.putalpha(ImageChops.multiply(alpha, mask))
        image = image.resize((round(image.width*scale), round(image.height*scale)), Image.Resampling.LANCZOS)
        x = round(width/2-(pose['rootX']-bounds[0])*scale)
        y = round(baseline-(bottom-bounds[1])*scale)
        if x < 0 or y < 0 or x+image.width > width or y+image.height > height:
            raise ValueError('Pose exceeds frame: '+pose['name'])
        frame = Image.new('RGBA', (width, height))
        frame.alpha_composite(image, (x, y))
        poses.append(frame)
    atlas = Image.new('RGBA', (width*10, height*len(profile['actions'])))
    for row, (name, indices) in enumerate(profile['actions'].items()):
        if len(indices) != 10:
            raise ValueError('Expected ten frames for '+name)
        for col, index in enumerate(indices):
            atlas.alpha_composite(poses[index], (col*width, row*height))
    output = Path(output) if output else ROOT/'public/sprites'/f'{fighter}.png'
    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, optimize=True)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fighter', choices=('azhi', 'gambler', 'winnie', 'sezi'), default='azhi')
    args = parser.parse_args()
    print(build(fighter=args.fighter))
