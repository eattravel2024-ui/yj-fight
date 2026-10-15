#!/usr/bin/env python3
"""Import a legally obtained, KOF13-style spritesheet into an ORIGINAL user's fighter.

Does NOT download third-party assets and never imports characters automatically.
The user must possess permission to use source images.
"""
import argparse
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps

ACTS=['idle','walk','jump','light','light2','light3','heavy','kick','low','upper','throw','dash','guard','hurt','special','ko','win']
ALIAS={'idle':'stand','walk':'D','jump':'W','light':'J','light2':'J','light3':'U','heavy':'K','kick':'I','low':'SK','upper':'SU','throw':'SJ','dash':'DD','guard':'C2G','hurt':'stand','special':'SI','ko':'stand','win':'stand'}
CHARS=['sam','winnie','sezi','gambler','azhi']
W,H,COLS=240,300,10

def get_rect(meta, act):
    action=meta.get('aliases',{}).get(act,ALIAS[act]); item=meta.get('rects',{}).get(action)
    if item is None:return None
    if isinstance(item,list) and len(item)>=4:
        w,h,pt,count=item[:4];x=pt.get('x',0) if isinstance(pt,dict) else pt[0];y=pt.get('y',0) if isinstance(pt,dict) else pt[1]
    elif isinstance(item,dict):
        x,y,w,h,count=(item[k] for k in ['x','y','w','h','frames'])
    else:raise ValueError(f'{action} invalid rect, expected [width,height,{{x,y}},frames]')
    vals=list(map(int,[x,y,w,h,count]));assert vals[2]>0 and vals[3]>0 and vals[4]>0,'invalid frame dimensions';return vals

def convert(src,meta,out):
    with Image.open(src) as im:
        im.load();im=im.convert('RGBA');sw,sh=im.size
        assert sw*sh<=600000000,'input image too large'
        dest=Image.new('RGBA',(W*COLS,H*len(ACTS)))
        chosen={}
        for row,act in enumerate(ACTS):
            rec=get_rect(meta,act) or get_rect(meta,'idle')
            if rec is None: raise ValueError('No idle/stand animation. Need at least an idle rectangle.')
            x,y,w,h,count=rec;chosen[act]=meta.get('aliases',{}).get(act,ALIAS[act])
            for col in range(COLS):
                index=round(col*(count-1)/(COLS-1))
                bounds=(x+w*index,y,x+w*(index+1),y+h)
                if bounds[0]<0 or bounds[1]<0 or bounds[2]>sw or bounds[3]>sh:raise ValueError(f'Out-of-bounds {act} frame {index}: {bounds} within {(sw,sh)}')
                frame=im.crop(bounds);frame.thumbnail((W-18,H-14),Image.Resampling.LANCZOS)
                # Bottom-center aligned to 60Hz world feet. Preserve native original proportions.
                dest.alpha_composite(frame,(col*W+(W-frame.width)//2,row*H+H-frame.height-7))
        out.parent.mkdir(parents=True,exist_ok=True)
        if out.exists():
            backup=out.with_name(out.stem+'.backup.png')
            if backup.exists():raise FileExistsError(f'Existing backup: {backup}; rename or remove safely before importing again')
            shutil.copy2(out,backup)
        dest.save(out,optimize=True)
        return {'source':str(src),'file':str(out),'actors':len(ACTS),'frames':len(ACTS)*COLS,'alias':chosen}

def main():
    a=argparse.ArgumentParser(description='Convert rights-cleared legacy KOF-style sprite atlas to a five-fighter original animation atlas')
    a.add_argument('--fighter',required=True,choices=CHARS)
    a.add_argument('--image',required=True,type=Path,help='User-provided local PNG (no downloads)')
    a.add_argument('--metadata',required=True,type=Path,help='JSON with rects mapping and optional aliases')
    a.add_argument('--authorized',action='store_true',help='I have rights to use and redistribute the input art')
    a.add_argument('--output-dir',type=Path,default=Path(__file__).resolve().parent.parent/'public'/'sprites')
    args=a.parse_args()
    if not args.authorized:a.error('Licensing confirmation required: pass --authorized only if you possess the rights to the images')
    meta=json.loads(args.metadata.read_text('utf-8'))
    result=convert(args.image,meta,args.output_dir/f'{args.fighter}.png')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
