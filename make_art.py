from pathlib import Path
from PIL import Image,ImageEnhance,ImageFilter
import math, random, html
root=Path(__file__).parent/'public'; art=root/'art';art.mkdir(parents=True,exist_ok=True)
random.seed(7)
colors={'night':['#101b3e','#1b1636','#ff55a8','#51ddeb','#f9b45a'], 'garage':['#101b2f','#192d40','#6ecbf3','#f6a747','#e85c8d'], 'harbor':['#10182e','#182944','#54f0d0','#ffb870','#8b8ff9']}
for name in colors:
 sky,deep,accent,accent2,warm=colors[name]
 p=[f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 960 540"><defs>
 <linearGradient id="sky" x2="0" y2="1"><stop stop-color="{sky}"/><stop offset=".70" stop-color="{deep}"/><stop offset="1" stop-color="#272143"/></linearGradient>
 <linearGradient id="ground" x2="0" y2="1"><stop stop-color="#35304c"/><stop offset="1" stop-color="#0d1127"/></linearGradient>
 <linearGradient id="light" x2="1" y2="1"><stop stop-color="{accent}" stop-opacity=".88"/><stop offset="1" stop-color="{accent2}" stop-opacity=".1"/></linearGradient>
 <filter id="glow"><feGaussianBlur stdDeviation="5"/></filter><pattern id="tile" width="76" height="30" patternUnits="userSpaceOnUse"><path d="M0 0H76M0 0L-8 30" fill="none" stroke="#a9d1ea" stroke-opacity=".12"/></pattern></defs>
 <rect width="960" height="540" fill="url(#sky)"/>
 <circle cx="775" cy="82" r="78" fill="{accent}" opacity=".12" filter="url(#glow)"/><circle cx="775" cy="82" r="47" fill="#fff2da" opacity=".17"/>
 <g opacity=".26">''']
 for i in range(22):
  x=i*49-15;y=180+random.randint(-105,55);h=387-y
  p.append(f'<rect x="{x}" y="{y}" width="{random.randint(32,56)}" height="{h}" fill="{["#080d20","#0b1630","#191a3b"][i%3]}"/>')
  for a in range(2):
   for b in range(7):
    xx=x+7+a*16;yy=y+12+b*22
    if yy<360:p.append(f'<rect x="{xx}" y="{yy}" width="6" height="9" fill="{warm}" opacity="{random.choice([.08,.2,.32,.4])}"/>')
 p.append('</g>')
 if name=='night':
  p.extend([f'<path d="M0 115 Q220 25 480 80 T960 105" stroke="{accent2}" opacity=".25" stroke-width="3" fill="none"/>',
   '<path d="M0 95L960 125" stroke="#0c1533" stroke-width="3"/>'])
  for x,y,r in [(100,143,17),(290,135,22),(508,155,19),(734,137,21),(883,152,15)]:
   p.append(f'<path d="M{x} 92V{y}" stroke="#8a5e6c" stroke-width="2"/><ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r*1.1}" fill="#ff745e" opacity=".86"/><path d="M{x-r+4} {y}H{x+r-4}" stroke="#ffe1aa" opacity=".65"/><ellipse cx="{x}" cy="{y}" rx="{r*2.4}" ry="{r*2.6}" fill="#ff8c7c" opacity=".09" filter="url(#glow)"/>')
  # storefronts
  for x,lab,col in [(0,'海線車行','#38bdf8'),(192,'燒烤食堂','#f973a3'),(700,'深夜咖啡','#fbbf65'),(846,'老街雜貨','#6ee7c6')]:
   p.append(f'<rect x="{x}" y="235" width="178" height="144" rx="3" fill="#0c172c" stroke="{col}" stroke-opacity=".55"/><rect x="{x+7}" y="251" width="162" height="36" rx="5" fill="{col}" opacity=".21"/><rect x="{x+10}" y="254" width="156" height="28" rx="3" fill="#132038"/><text x="{x+20}" y="275" fill="{col}" font-size="19" font-weight="800" font-family="sans-serif">{lab}</text><rect x="{x+15}" y="314" width="148" height="46" fill="{col}" opacity=".09"/>')
  # neon board center
  p.append(f'<path d="M375 105L570 105L590 129L560 156L380 156L357 128Z" fill="#15142e" stroke="{warm}" stroke-width="3"/><text x="473" y="139" fill="{warm}" font-size="30" font-weight="900" text-anchor="middle" font-family="sans-serif">霓虹夜市</text>')
 elif name=='garage':
  p.extend(['<rect x="0" y="94" width="960" height="310" fill="#0c1a2c"/>','<path d="M0 105H960M0 105L330 320M960 105L630 320" stroke="#5b7488" stroke-width="9" opacity=".55"/>','<path d="M0 190H960M0 325H960" stroke="#46576f" stroke-width="5" opacity=".55"/>'])
  for i in range(8):
   x=i*137+27;p.append(f'<rect x="{x}" y="105" width="18" height="296" fill="#26394d" stroke="#698299" stroke-opacity=".45"/>')
  for x,c in [(120,'#4bdaf0'),(460,'#fba74d'),(805,'#fa6a9a')]:
   p.append(f'<rect x="{x-15}" y="153" width="180" height="60" rx="9" fill="#0e2131" stroke="{c}" stroke-width="3"/><text x="{x+75}" y="191" fill="{c}" text-anchor="middle" font-size="26" font-weight="900" font-family="sans-serif">{("改裝中心" if x==120 else "REPAIR" if x==460 else "HAIXIAN")}</text>')
  for x in (100,680):
   p.append(f'<path d="M{x} 345h165l24 30h-210z" fill="#173050" stroke="#66d9fa" stroke-width="4"/><circle cx="{x+30}" cy="376" r="22" fill="#060f1a" stroke="#89a5ba" stroke-width="5"/><circle cx="{x+153}" cy="376" r="22" fill="#060f1a" stroke="#89a5ba" stroke-width="5"/>')
 elif name=='harbor':
  p.extend(['<path d="M0 285L960 280V386H0Z" fill="#11213d"/>','<path d="M0 301L960 301" stroke="#7b9dc2" stroke-width="4" opacity=".6"/>'])
  for x in (50,285,690):
   p.append(f'<path d="M{x} 95L{x} 315M{x} 98L{x+185} 98M{x+185} 98L{x+185} 300M{x} 98L{x+160} 210" stroke="#6a88a9" stroke-width="6" fill="none"/><path d="M{x+170} 98V285" stroke="#93b3d1" stroke-width="2"/>')
  for i,(x,c) in enumerate([(0,'#d75e81'),(192,'#3499bc'),(410,'#ffa855'),(655,'#697fb2')]):
   p.append(f'<rect x="{x}" y="299" width="210" height="80" rx="3" fill="{c}" opacity=".7" stroke="#d0e2fc" stroke-width="2"/><path d="M{x+15} 309V365M{x+45} 309V365M{x+75} 309V365M{x+105} 309V365M{x+135} 309V365M{x+165} 309V365" stroke="#06152c" stroke-width="3" opacity=".4"/>')
 p.extend(['<path d="M0 378H960V540H0Z" fill="url(#ground)"/>','<rect x="0" y="390" width="960" height="150" fill="url(#tile)"/>',f'<path d="M0 378H960" stroke="{accent}" stroke-width="4" opacity=".65"/>'])
 for i in range(20):
  x=random.randint(0,960);y=random.randint(401,535);w=random.randint(7,50)
  p.append(f'<path d="M{x} {y}h{w}" stroke="{random.choice([accent,accent2,warm])}" stroke-opacity="{random.uniform(.05,.23):.2f}" stroke-width="{random.randint(1,3)}"/>')
 p.append('<path d="M0 496Q360 474 960 502V540H0" fill="#060d1e" opacity=".3"/></svg>')
 (art/f'{name}.svg').write_text('\n'.join(p),encoding='utf8')
# crop promotional generated art into actual portrait thumbnails (source generated for this game)
source=Path('/mnt/data/a_wide_colorful_promotional_game_interface_collag.png')
if source.exists():
 im=Image.open(source).convert('RGB'); print('source art:', im.size)
 # first three fighter thumbnails, crop only faces/upper bodies without text
 boxes={'azhi':(12,632,163,752),'xiaotao':(172,632,313,752),'akai':(327,632,473,752)}
 for key,box in boxes.items():
  crop=im.crop(box).resize((320,256),Image.Resampling.LANCZOS)
  crop=ImageEnhance.Contrast(crop).enhance(1.08)
  crop.save(art/f'portrait_{key}.webp',quality=92)
print('Assets:',[(p.name,p.stat().st_size) for p in art.iterdir()])
