"""Create original transparent cinematic impact sprite atlas, no copyrighted source assets."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from pathlib import Path
from math import sin,cos,pi
import random
random.seed(83)
SIZE=512; OUTPUT=256
palette=[(255,228,155),(255,143,70),(82,205,255),(175,87,255)]
alltiles=[]
for idx,base in enumerate(palette):
    yy,xx=np.mgrid[0:SIZE,0:SIZE].astype(float)
    dx=(xx-SIZE/2)/(SIZE/2);dy=(yy-SIZE/2)/(SIZE/2)
    theta=np.arctan2(dy,dx)
    r=np.sqrt((dx/(1.07 if idx!=2 else 1.3))**2+(dy/(.8 if idx==1 else 1.0))**2)
    # Center bloom is translucent, preserving correct compositing over fighters and scenery.
    noise=np.random.default_rng(83+idx).normal(0,1,(SIZE,SIZE))
    glow=np.exp(-((r/.54)**1.6)*4)*80
    core=np.exp(-(r/.20)**2*3.4)*180
    beam=np.maximum(0,np.cos(theta*9+np.sin(r*15)*.08))**20*np.exp(-r*2.0)*95
    alpha=np.clip(glow+core+beam+noise*.9,0,230).astype('uint8')
    rgb=np.zeros((SIZE,SIZE,4),dtype='uint8');rgb[:,:,0]=base[0];rgb[:,:,1]=base[1];rgb[:,:,2]=base[2];rgb[:,:,3]=alpha
    tile=Image.fromarray(rgb,'RGBA')
    # Colored, blurred light energy beneath crisp fragments.
    streaks=Image.new('RGBA',(SIZE,SIZE));d=ImageDraw.Draw(streaks)
    for i in range(24 if idx!=2 else 13):
        a=i*2*pi/(24 if idx!=2 else 13)+random.uniform(-.17,.17)
        rr=random.uniform(128,215) if idx!=2 else random.uniform(114,160)
        x0=SIZE/2+cos(a)*28;y0=SIZE/2+sin(a)*23
        x1=SIZE/2+cos(a)*rr;y1=SIZE/2+sin(a)*rr*.74
        side=random.uniform(2,12)
        points=[(x0+cos(a+pi/2)*side,y0+sin(a+pi/2)*side),(x1,y1),(x0+cos(a-pi/2)*side,y0+sin(a-pi/2)*side)]
        bright=180 if idx!=3 else 120
        d.polygon(points,fill=(*base,random.randint(25,bright)))
    haze=streaks.filter(ImageFilter.GaussianBlur(14));tile=Image.alpha_composite(tile,haze);tile=Image.alpha_composite(tile,streaks)
    d=ImageDraw.Draw(tile)
    # Fractured arcs / hard bright edge; guard uses an elliptical shield instead.
    if idx==2:
        for radius in [110,160,195]:d.arc((SIZE/2-radius*.64,SIZE/2-radius,SIZE/2+radius*.64,SIZE/2+radius),70,290,fill=(208,250,255,128 if radius<160 else 75),width=6)
    else:
        for ring in range(2):
            rr=82+ring*61
            d.arc((SIZE/2-rr,SIZE/2-rr*.71,SIZE/2+rr,SIZE/2+rr*.71),random.randint(0,40),random.randint(265,335),fill=(255,245,215,80-ring*22),width=3+ring)
    for i in range(15):
        a=random.random()*pi*2; r0=random.uniform(38,150)
        cx=SIZE/2+cos(a)*r0;cy=SIZE/2+sin(a)*r0*.76
        line=random.randint(2,7)
        d.line((cx,cy,cx+cos(a)*line*4,cy+sin(a)*line*4),fill=(255,252,224,random.randint(90,185)),width=random.randint(1,3))
    tile=tile.resize((OUTPUT,OUTPUT),Image.Resampling.LANCZOS);alltiles.append(tile)
out=Image.new('RGBA',(OUTPUT*4,OUTPUT))
for i,tile in enumerate(alltiles):out.alpha_composite(tile,(OUTPUT*i,0))
p=Path('/mnt/data/azhi83/public/art/vfx/impact_energy.png');p.parent.mkdir(parents=True,exist_ok=True);out.save(p,optimize=True)
print('wrote',p,out.size,p.stat().st_size)
