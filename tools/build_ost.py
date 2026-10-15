#!/usr/bin/env python3
"""Preserve supplied OGG/MIDI; publish OGG with AAC fallback, plus a runtime manifest."""
import hashlib,json,shutil,subprocess,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source-audio/ost'
OUT=ROOT/'public/audio/ost'

def info(path):
    raw=path.read_bytes()
    return {'path':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}

def build():
    source=json.loads((SOURCE/'manifest.json').read_text())
    if len(source['tracks'])!=21 or len({t['id'] for t in source['tracks']})!=21:raise ValueError('Expected 21 unique tracks')
    OUT.mkdir(parents=True,exist_ok=True)
    runtime={'project':'陪公子練武','source':'User-provided BIG_TALK_OST_21_tracks.zip','tracks':[]}
    audit={'sourceManifest':info(SOURCE/'manifest.json'),'tracks':[]}
    audit_file=SOURCE/'asset-manifest.json'
    previous={t['id']:t for t in json.loads(audit_file.read_text())['tracks']} if audit_file.exists() else {}
    for track in source['tracks']:
        if not re.fullmatch(r'audio/\d{2}-[a-z]+\.ogg',track['file']) or not re.fullmatch(r'midi/\d{2}-[a-z]+\.mid',track['midi']) or Path(track['file']).stem!=Path(track['midi']).stem:raise ValueError('Unsafe or mismatched source paths')
        if not re.fullmatch(r'[a-z][a-z0-9_]*',track['id']) or track['kind'] not in ['bgm','sting']:raise ValueError('Invalid track metadata')
        name=Path(track['file']).name;src=SOURCE/track['file'];ogg=OUT/name;aac=ogg.with_suffix('.m4a')
        shutil.copyfile(src,ogg)
        prior=previous.get(track['id'],{})
        if not aac.exists() or prior.get('originalAudio',{}).get('sha256')!=info(src)['sha256'] or prior.get('aac',{}).get('sha256')!=info(aac)['sha256']:
            subprocess.run(['ffmpeg','-y','-v','error','-nostdin','-i',str(src),'-c:a','aac','-b:a','96k','-map_metadata','-1','-movflags','+faststart',str(aac)],check=True)
        probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',str(src)]))
        assert probe['streams'][0]['codec_name']=='vorbis'
        assert abs(float(probe['format']['duration'])-track['seconds'])<.1
        runtime['tracks'].append({**{k:track[k] for k in ['id','title','title_zh','kind','loop','volume','seconds']},'sources':[f'audio/ost/{ogg.name}',f'audio/ost/{aac.name}']})
        audit['tracks'].append({'id':track['id'],'originalAudio':info(src),'midi':info(SOURCE/track['midi']),'ogg':info(ogg),'aac':info(aac),'probe':probe})
    (ROOT/'public/audio/manifest.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n')
    (SOURCE/'asset-manifest.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
    print('Published 21 OGG + 21 AAC; original MIDI retained; sources hashed')
if __name__=='__main__':build()
