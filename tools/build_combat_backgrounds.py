"""Build presentation-only battle variants; originals and stage geometry stay untouched."""
from pathlib import Path
import hashlib,json
from PIL import Image, ImageEnhance
ROOT=Path(__file__).resolve().parents[1]/'public/art/stages'
SETTINGS={'night-market':(.80,.91,.93),'golden-casino':(.78,.90,.92),'tiananmen-square':(.78,.91,.94)}
records={}
for name,(saturation,brightness,contrast) in SETTINGS.items():
    source=Image.open(ROOT/name/'background.webp').convert('RGBA')
    base=Image.new('RGBA',source.size,'#101522'); base.alpha_composite(source)
    art=ImageEnhance.Color(base.convert('RGB')).enhance(saturation)
    art=ImageEnhance.Brightness(art).enhance(brightness)
    art=ImageEnhance.Contrast(art).enhance(contrast)
    art=Image.blend(art,Image.new('RGB',art.size,'#152b46'),.025)
    art.save(ROOT/name/'combat.webp','WEBP',quality=91,method=6)
    output=ROOT/name/'combat.webp'
    records[name]={'source':'art/stages/'+name+'/background.webp','sourceSha256':hashlib.sha256((ROOT/name/'background.webp').read_bytes()).hexdigest(),'output':'art/stages/'+name+'/combat.webp','outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'width':art.width,'height':art.height,'bytes':output.stat().st_size,'saturation':saturation,'brightness':brightness,'contrast':contrast,'coolTint':.025,'purpose':'Background layer only; proportional rendering, no stage geometry changes'}
    print(name,art.size,output.stat().st_size)
(ROOT/'combat-manifest.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
