"""Hand-built original cel-shaded 2D fighters. Frame-by-frame SVG rasterized into actual PNG atlases."""
from PIL import Image,ImageDraw
from io import BytesIO
from pathlib import Path
import cairosvg,math,json
from PIL import ImageEnhance,ImageFilter
OUT=Path(__file__).parent/'public'/'sprites';OUT.mkdir(exist_ok=True)
W,H,FR=240,300,10
ACTS=['idle','walk','jump','light','light2','light3','heavy','kick','low','upper','throw','dash','guard','hurt','special','ko','win']
PAL={
 'winnie':dict(name='維尼',coat='#d43243',coat2='#991e35',skin='#e7a979',shade='#b97855',hair='#20202d',trim='#ffce58',pants='#e8ad33',shoe='#eec858',accent='#ffb64d'),
 'sezi':dict(name='塞子',coat='#f1e9d2',coat2='#bcb4a9',skin='#e4aa87',shade='#b8776b',hair='#e3dbca',trim='#ffefa0',pants='#dbd5cc',shoe='#fff5df',accent='#ffdc76'),
 'gambler':dict(name='金沙賭神',coat='#6638bc',coat2='#341876',skin='#eec5b0',shade='#be8b88',hair='#0e1624',trim='#ffd34d',pants='#2c2450',shoe='#ffffff',accent='#ba8dff'),
 'azhi':dict(name='阿志',coat='#426a45',coat2='#233e37',skin='#ecc3a6',shade='#bf8e70',hair='#10151e',trim='#e8e3ce',pants='#b3a994',shoe='#e8edce',accent='#75e0a5')
}


def pt(q):return f'{q[0]:.1f},{q[1]:.1f}'
def path_joint(a,b,width,fill,stroke='#10172a'):
 return f'<path d="M {pt(a)} L {pt(b)}" stroke="{stroke}" stroke-width="{width+9}" stroke-linecap="round"/><path d="M {pt(a)} L {pt(b)}" stroke="{fill}" stroke-width="{width}" stroke-linecap="round"/><path d="M {pt(a)} L {pt(b)}" stroke="#ffffff22" stroke-width="2.7" stroke-linecap="round"/>'
def poly(points,fill,edge='#10172a',width=5):return f'<polygon points="{" ".join(pt(p) for p in points)}" fill="{fill}" stroke="{edge}" stroke-width="{width}" stroke-linejoin="round"/>'
def ellipse(cx,cy,rx,ry,fill,stroke='#10172a',sw=3):return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def svg(cid,act,n):
 c=PAL[cid];phase=n/(FR-1);cycle=math.sin(n/FR*math.tau)
 bob=(2.8*cycle if act=='idle' else 2.4*cycle if act=='walk' else 0)
 lean=0;reach=0;raise_=0;forward_leg=0;leg_lift=0;stance=0;backreach=0;headtilt=0
 power=0
 # Each move has an original pose curve (rather than reusing identical animation frames).
 if act in ('light','light2','light3','heavy','kick','low','upper','throw','special'):
  curves={
   'light':[0,-.12,.12,.7,1,1,.58,.3,.12,0],
   'light2':[0,-.15,.08,.55,.95,1,.7,.34,.1,0],
   'light3':[0,-.18,-.1,.3,.78,1,1,.6,.24,0],
   'heavy':[0,-.25,-.27,-.05,.3,.87,1,.9,.4,0],
   'kick':[0,-.1,.1,.44,.86,1,1,.7,.25,0],
   'low':[0,-.17,-.1,.3,.72,1,1,.65,.23,0],
   'upper':[0,-.2,-.25,.1,.52,.93,1,.7,.25,0],
   'throw':[0,-.13,.09,.56,.92,1,1,.7,.3,0],
   'special':[0,-.1,-.2,-.1,.28,.56,.85,1,.75,.1]}
  power=curves[act][n]
 if act=='walk':lean=3*cycle;stance=18*cycle
 if act=='jump':bob=-24-17*math.sin(math.pi*phase);stance=12;leg_lift=20
 if act=='dash':lean=22;stance=17;bob=4
 if act=='guard':reach=-20;raise_=47;backreach=10
 if act=='hurt':lean=-[0,5,17,23,18,13,8,5,2,0][n];headtilt=lean*.4
 if act=='ko':lean=-14-35*phase;bob=27*phase;headtilt=13*phase
 if act=='win':reach=17;raise_=90*min(1,phase*2);bob=-4
 if act=='light':lean=5*power;reach=67*power;raise_=20*power
 if act=='light2':lean=8*power;reach=70*power;raise_=40*power;backreach=7*power
 if act=='light3':lean=10*power;reach=83*power;raise_=10*power;backreach=-14*power
 if act=='heavy':lean=19*power;reach=82*power;raise_=65*power;headtilt=-4*power
 if act=='kick':lean=-13*power;forward_leg=92*power;leg_lift=73*power;reach=-10*power;raise_=32*power
 if act=='low':lean=-17*power;bob=24*power;forward_leg=91*power;leg_lift=17*power;reach=-5*power
 if act=='upper':lean=17*power;reach=40*power;raise_=115*power;bob=-21*power;headtilt=-4*power
 if act=='throw':lean=15*power;reach=54*power;raise_=29*power;backreach=52*power
 if act=='special':lean=9*power;reach=68*power;raise_=40*power;backreach=45*power
 # Original choreography per fighter, while keeping exact 17-row animation atlas.
 if cid=='winnie':
  if act=='heavy':lean+=9*power;raise_-=35*power
  if act=='low':forward_leg+=29*power;bob+=10*power
  if act=='special':bob+=31*power;lean-=15*power;raise_-=30*power;reach+=12*power;forward_leg+=36*power
 if cid=='sezi':
  if act=='kick':leg_lift+=34*power;forward_leg+=20*power;bob-=10*power
  if act=='upper':headtilt-=7*power;raise_+=22*power
  if act=='special':lean+=15*math.sin(phase*math.pi*4)*power;headtilt+=13*math.sin(phase*math.pi*2)*power;leg_lift+=39*power;bob-=13*power;forward_leg+=36*power
 if cid=='gambler':
  if act=='light':reach+=22*power
  if act=='heavy':lean-=6*power;reach+=18*power
  if act=='special':lean-=11*power;reach+=31*power;raise_+=18*power;backreach+=18*power
 if cid=='azhi':
  if act=='upper':lean+=12*power;bob-=14*power;raise_+=22*power
  if act=='special':lean+=14*power;raise_+=22*power;reach+=26*power;backreach-=16*power
 x=112+lean*0.55;y=bob
 hip=(x,187+y);neck=(x+lean*.10,115+y);head=(x+lean*.14,75+y+headtilt)
 bkhip=(x-17,190+y);frhip=(x+19,190+y)
 backknee=(x-29-stance*.7,229+y-leg_lift*.06);backfoot=(x-37-stance*1.0,272+y-leg_lift*.04)
 frknee=(x+28+stance*.7+forward_leg*.35,224+y-leg_lift*.53);frfoot=(x+43+stance+forward_leg,272+y-leg_lift)
 shoulderBack=(x-22,128+y);elbowBack=(x-38+backreach*.3,164+y-raise_*.13);handBack=(x-19+backreach,182+y-raise_*.53)
 shoulderFront=(x+22,128+y);elbowFront=(x+40+reach*.42,150+y-raise_*.34);handFront=(x+49+reach,168+y-raise_)
 if act=='guard':elbowFront=(x+35,133+y);handFront=(x+31,86+y);elbowBack=(x-25,137+y);handBack=(x+4,96+y)
 if act=='hurt':handFront=(x+27,95+y);handBack=(x-37,111+y)
 if act=='jump':handFront=(x+57,119+y);handBack=(x-43,105+y)
 if act=='ko':handFront=(x+45,199+y);handBack=(x-31,198+y)
 if act=='win':handBack=(x-48,60+y)
 jacket=c['coat'];dark=c['coat2'];pant=c['pants'];skin=c['skin'];shadow=c['shade'];hair=c['hair'];trim=c['trim'];accent=c['accent'];shoe=c['shoe']
 defs=f'''<defs><linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{jacket}"/><stop offset="1" stop-color="{dark}"/></linearGradient><linearGradient id="pants" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="{pant}"/><stop offset="1" stop-color="#0d1625"/></linearGradient><linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{skin}"/><stop offset="1" stop-color="{shadow}"/></linearGradient><linearGradient id="metal"><stop stop-color="#ffffff"/><stop offset=".5" stop-color="{trim}"/><stop offset="1" stop-color="#7f6074"/></linearGradient></defs>'''
 shapes=[]
 # Feet and legs, with cel-shaped knee armor and laces.
 shapes.append(path_joint(bkhip,backknee,31,'url(#pants)'))
 shapes.append(path_joint(backknee,backfoot,27,'url(#pants)'))
 shapes.append(poly([(backfoot[0]-20,backfoot[1]-8),(backfoot[0]+25,backfoot[1]-8),(backfoot[0]+33,backfoot[1]+6),(backfoot[0]-23,backfoot[1]+6)],shoe))
 shapes.append(path_joint(frhip,frknee,34,'url(#pants)'))
 shapes.append(path_joint(frknee,frfoot,29,'url(#pants)'))
 shapes.append(poly([(frfoot[0]-16,frfoot[1]-10),(frfoot[0]+29,frfoot[1]-10),(frfoot[0]+36,frfoot[1]+6),(frfoot[0]-20,frfoot[1]+6)],shoe))
 # boot soles & trouser creases
 for foot in (backfoot,frfoot):shapes.append(f'<path d="M {foot[0]-20},{foot[1]+6} l 54,0" stroke="{accent}" stroke-width="4" stroke-linecap="round"/>')
 for knee in (backknee,frknee):shapes.append(f'<path d="M{knee[0]-13},{knee[1]-6} l 13,5" stroke="#faf8ff77" stroke-width="3"/>')
 # back arm, followed by torso
 shapes.append(path_joint(shoulderBack,elbowBack,24,'url(#jacket)'))
 shapes.append(path_joint(elbowBack,handBack,22,skin))
 shapes.append(ellipse(handBack[0],handBack[1],14,13,'url(#face)'))
 # coat silhouette includes strong silhouette shape and contrast piping
 shapes.append(poly([(x-24+lean*.06,112+y),(x+26+lean*.09,110+y),(x+38,142+y),(x+28,188+y),(x-30,188+y),(x-37,138+y)],'url(#jacket)',width=6))
 shapes.append(poly([(x-9,116+y),(x+13,116+y),(x+8,179+y),(x-11,179+y)],'#f4e5da',width=2))
 shapes.append(f'<path d="M{x-10},{119+y} Q {x+8},{133+y} {x+14},{118+y}" stroke="{trim}" fill="none" stroke-width="5"/>')
 shapes.append(f'<path d="M{x-28},{132+y} L{x-18},{174+y} M{x+30},{132+y} L{x+22},{177+y}" stroke="{trim}" stroke-width="4" stroke-linecap="round" opacity=".75"/>')
 shapes.append(f'<path d="M{x-15},{184+y} L{x+23},{184+y}" stroke="#111727" stroke-width="10"/><path d="M{x+4},{180+y} l 0,10" stroke="{trim}" stroke-width="6"/>')
 if cid=='gambler':
  shapes.append(poly([(x+9,117+y),(x+36,123+y),(x+27,159+y),(x+7,153+y)],skin,width=2))
  shapes.append(f'<path d="M{x+15},{139+y} l 13,-8 l 1,12 l -10,3" fill="none" stroke="#684b4c" stroke-width="3"/>')
 if cid=='sezi':
  shapes.append(poly([(x-25,187+y),(x+29,187+y),(x+36,210+y),(x-34,210+y)],'#51275f',width=3))
  for dx in (-17,0,17):shapes.append(f'<path d="M{x+dx},{191+y} l -3,17" stroke="{trim}" stroke-width="2" opacity=".6"/>')
 if cid=='gambler':shapes.append(f'<path d="M{x-27},{137+y} L{x-19},{125+y} M{x+19},{164+y} l 9,-12" stroke="{accent}" stroke-width="5" stroke-linecap="round"/>')
 # Class-specific silhouettes make fighters distinguishable even at small scale.
 if cid=='winnie':
  shapes.append(ellipse(x,155+y,34,49,'#e6b13c',sw=4))
  shapes.append(poly([(x-16,118+y),(x+22,118+y),(x+27,157+y),(x-20,157+y)],'#ce273d',width=3))
  for dx,dy,r in ((-9,130,3),(0,135,3),(8,139,3)):shapes.append(ellipse(x+dx,dy+y,r,r,'#ffda55',sw=0))
 if cid=='sezi':
  for dx,dy in ((-22,125),(12,127),(-29,157),(26,166),(3,180)):
   shapes.append(ellipse(x+dx,dy+y,17,13,'#fff4df',stroke='#e6d9b8',sw=2))
  shapes.append(f'<path d="M{x+24},{y+138} l 26,-15" stroke="#b9b9c0" stroke-width="7"/>')
 if cid=='gambler':
  shapes.append(f'<circle cx="{x+8}" cy="{y+157}" r="12" fill="#fbd45b" stroke="#a47b38" stroke-width="3"/>')
  shapes.append(f'<text x="{x+8}" y="{y+162}" text-anchor="middle" font-size="15" font-weight="900" fill="#5e3290">$</text>')
 if cid=='azhi':
  shapes.append(f'<path d="M{x-29},{y+129} Q{x-47},{y+142} {x-38},{y+177}" fill="none" stroke="#d6cfba" stroke-width="16" stroke-linecap="round"/>')
 # neck and head with layered jaw, hair, brows, chin shading
 shapes.append(poly([(head[0]-9,head[1]+20),(head[0]+10,head[1]+20),(head[0]+9,head[1]+47),(head[0]-9,head[1]+44)],skin,width=4))
 shapes.append(ellipse(head[0],head[1],27,35,'url(#face)',sw=5))
 shapes.append(poly([(head[0]+17,head[1]+7),(head[0]+30,head[1]+11),(head[0]+18,head[1]+16)],skin,width=2))
 if cid=='gambler':
  shapes.append(poly([(head[0]-28,head[1]-22),(head[0]+24,head[1]-24),(head[0]+26,head[1]-8),(head[0]-25,head[1]-12)],hair,width=4))
  shapes.append(f'<path d="M{head[0]-23},{head[1]-20} l 14,-13 l 19,4 l 15,7" fill="none" stroke="#e5f2ff" stroke-width="5"/>')
 elif cid=='sezi':
  shapes.append(ellipse(head[0]-31,head[1]-23,16,20,hair,sw=5))
  shapes.append(ellipse(head[0]+27,head[1]-26,15,19,hair,sw=5))
  shapes.append(poly([(head[0]-28,head[1]-21),(head[0]-17,head[1]-40),(head[0]+2,head[1]-42),(head[0]+19,head[1]-30),(head[0]+28,head[1]-17),(head[0]+3,head[1]-17),(head[0]-14,head[1]-12)],hair,width=4))
  shapes.append(f'<path d="M{head[0]-25},{head[1]-23} Q {head[0]-34},{head[1]+12} {head[0]-28},{head[1]+36}" fill="none" stroke="{hair}" stroke-width="11"/>')
 elif cid=='winnie':
  shapes.append(ellipse(head[0]-20,head[1]-32,13,13,'#e9ae3f'))
  shapes.append(ellipse(head[0]+22,head[1]-32,13,13,'#e9ae3f'))
  shapes.append(poly([(head[0]-23,head[1]-27),(head[0]-10,head[1]-35),(head[0]+21,head[1]-30),(head[0]+24,head[1]-14),(head[0]-20,head[1]-11)],hair,width=3))
 elif cid=='azhi':
  shapes.append(poly([(head[0]-27,head[1]-23),(head[0]-20,head[1]-33),(head[0]+18,head[1]-35),(head[0]+27,head[1]-20),(head[0]+26,head[1]-10),(head[0]-26,head[1]-10)],hair,width=4))
 else:
  shapes.append(poly([(head[0]-29,head[1]-18),(head[0]-26,head[1]-43),(head[0]-7,head[1]-30),(head[0]+7,head[1]-50),(head[0]+18,head[1]-33),(head[0]+30,head[1]-39),(head[0]+25,head[1]-18),(head[0]+5,head[1]-13)],hair,width=4))
  shapes.append(f'<path d="M{head[0]-21},{head[1]-39} l 14,-10 l 9,8" stroke="#405066" stroke-width="3" fill="none"/>')
 shapes.append(f'<path d="M{head[0]+7},{head[1]-3} l 15,-3" stroke="{hair}" stroke-width="4" stroke-linecap="round"/>')
 shapes.append(f'<path d="M{head[0]+16},{head[1]+1} l 2,5" stroke="#122036" stroke-width="3" stroke-linecap="round"/>')
 shapes.append(f'<path d="M{head[0]+17},{head[1]+18} l -8,1" stroke="#9e5260" stroke-width="2.5"/>')
 # front arm and large individualized glove
 shapes.append(path_joint(shoulderFront,elbowFront,26,'url(#jacket)' if cid!='akai' else skin))
 shapes.append(path_joint(elbowFront,handFront,24,skin))
 shapes.append(ellipse(handFront[0],handFront[1],17,16,'url(#face)',sw=5))
 shapes.append(f'<path d="M{handFront[0]-11},{handFront[1]-8} l 19,-4" stroke="{accent}" stroke-width="5" stroke-linecap="round"/>')
 shapes.append(f'<path d="M{handFront[0]-4},{handFront[1]+1} l 8,0" stroke="#8b4d51" stroke-width="2"/>')
 # Unique prop silhouettes and movement arcs in the actual frame art.
 if cid=='gambler' and act in ('special','heavy') and power>.30:
  for i in range(3):
   cx=handFront[0]+24+i*(11+int(power*9));cy=handFront[1]-15-i*10
   shapes.append(f'<g transform="translate({cx},{cy}) rotate({-34+i*23})"><rect x="-7" y="-12" width="14" height="23" fill="#fef9df" stroke="#4d3187" stroke-width="2" rx="2"/><path d="M0,-6 l4,6 l-4,6 l-4,-6z" fill="#e6b85d"/></g>')
 if cid=='winnie' and act=='special' and power>.15:
  shapes.append(f'<path d="M {x-65},{272+y} q 70,{-17-11*power} 148,0" fill="none" stroke="#ffe48a" stroke-width="{4+power*8}" stroke-linecap="round" opacity=".80"/>')
  for j in range(3):shapes.append(f'<circle cx="{x+70+j*17}" cy="{268+y-j*7}" r="{2+int(power*4)}" fill="#ffd46a"/>')
 if cid=='sezi' and act=='special' and power>.26:
  shapes.append(f'<path d="M{x-56},{y+158} Q{x+32},{y+72} {x+130},{y+154}" fill="none" stroke="#f5eed9" stroke-width="{7+4*power}" stroke-linecap="round" opacity=".76"/>')
 if cid=='azhi' and act=='special' and power>.28:
  shapes.append(f'<path d="M{x-35},{y+158} Q{x+35},{y+44} {x+126},{y+81}" fill="none" stroke="#ebe8d7" stroke-width="14" stroke-linecap="round" opacity=".94"/>')
  shapes.append(f'<path d="M{x-35},{y+158} Q{x+35},{y+44} {x+126},{y+81}" fill="none" stroke="#61d8a8" stroke-width="3" opacity=".8"/>')
 if act in ('heavy','kick','upper','special','light3') and .45<power<.96:
  shapes.append(f'<path d="M{handFront[0]-15},{handFront[1]-23} Q {handFront[0]+27},{handFront[1]-39} {handFront[0]+45},{handFront[1]-19}" stroke="{accent}" stroke-width="5" fill="none" opacity=".8"/>')
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{defs}<g stroke-linejoin="round">{"".join(shapes)}</g></svg>'

manifest={'frameWidth':W,'frameHeight':H,'columns':FR,'framesPerAction':FR,'actions':ACTS,'characters':{}}
for cid,c in PAL.items():
 atlas=Image.new('RGBA',(W*FR,H*len(ACTS)))
 face=Image.open(Path(__file__).parent/'public'/'art'/('face_'+cid+'.png')).convert('RGBA')
 face=face.resize((53,66),Image.Resampling.LANCZOS)
 for row,act in enumerate(ACTS):
  for col in range(FR):
   raw=cairosvg.svg2png(bytestring=svg(cid,act,col).encode(),output_width=W,output_height=H)
   frame=Image.open(BytesIO(raw)).convert('RGBA')
   # Align the supplied reference likeness to each pose's neck/head animation.
   cycle=math.sin(col/FR*math.tau);phase=col/(FR-1)
   bob=2.8*cycle if act=='idle' else 2.4*cycle if act=='walk' else 0
   lean=0;headtilt=0
   if act=='dash':lean=22;bob=4
   if act=='hurt':lean=-[0,5,17,23,18,13,8,5,2,0][col];headtilt=lean*.4
   if act=='ko':lean=-14-35*phase;bob=27*phase;headtilt=13*phase
   if act=='jump':bob=-24-17*math.sin(math.pi*phase)
   curves={'light':[0,-.12,.12,.7,1,1,.58,.3,.12,0], 'heavy':[0,-.25,-.27,-.05,.3,.87,1,.9,.4,0], 'kick':[0,-.1,.1,.44,.86,1,1,.7,.25,0]}
   if act in curves:lean=(5 if act=='light' else 19 if act=='heavy' else -13)*curves[act][col]
   x=112+lean*.55;hy=75+bob+headtilt
   patch=face
   if act=='ko':patch=face.rotate(-min(55,65*phase),resample=Image.Resampling.BICUBIC,expand=False)
   frame.alpha_composite(patch,(int(x-26),int(hy-32)))
   # A concise character symbol on the outfit, matching each design.
   draw=ImageDraw.Draw(frame)
   if cid=='gambler':draw.ellipse((x-8,149+bob,x+16,173+bob),outline='#e2ab49',width=3)
   atlas.paste(frame,(col*W,row*H))
 atlas.save(OUT/(cid+'.png'),optimize=True)
 manifest['characters'][cid]={'name':c['name'],'file':'sprites/'+cid+'.png'}
 print(cid,'atlas bytes', (OUT/(cid+'.png')).stat().st_size,flush=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
