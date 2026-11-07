# story voices: kakek, baruna, wayan, ayu  x  de, en, id
import json,re,hashlib,os,subprocess,sys,tempfile,time
sys.path.insert(0,'/home/claude/tools'); from tts3 import tts_pcm
from concurrent.futures import ThreadPoolExecutor
APP='/home/claude/sea/app'; OUT=APP+'/assets/vo'
D={'en':json.load(open(APP+'/i18n_en.json')),'id':json.load(open(APP+'/i18n_id.json'))}
src=open(APP+'/app.js').read(); seg=src[src.index('playChapter = async function (n)'):]; seg=seg[:seg.index('window.__games.playChapter')]
def split(s): return [x.strip() for x in re.split(r'(?<=[.!?:])\s+', s) if x.strip()]
def norm(s): return re.sub(r'[.!?:…]+$','',re.sub(r'\s+',' ',re.sub(r'[«»“”"]','',s)).strip()).lower()
def T(s,l):
    if l=='de': return s
    d=D[l]; k=s.strip()
    if k in d: return d[k]
    if re.search(r'[.!?:]\s',k): return ' '.join(T(x,l) for x in split(k))
    return s
lines=[]
for f,txt,fact in re.findall(r"\b(K|Wy|Bn)\('((?:[^'\\]|\\.)+)'(?:, '((?:[^'\\]|\\.)+)')?\)",seg):
    lines.append((f,txt,fact))
for txt in re.findall(r"yay\('([^']+)'\)",seg): lines.append(('Y',txt,''))
WHO={'K':['kakek'],'Bn':['baruna'],'Wy':['wayan','ayu'],'Y':['wayan','ayu']}
jobs={}
def add(l,who,s):
    for x in split(s):
        if len(x)>1 and norm(x): jobs[(l,who,norm(x))]=x
for f,txt,fact in lines:
    for who in WHO[f]:
        for l in ('de','en','id'):
            for raw in [txt]+(['Wusstest du? '+fact] if fact else []):
                t=T(raw,l)
                heroes=['Ayu'] if who=='ayu' else (['Wayan'] if who=='wayan' else ['Wayan','Ayu'])
                for h in heroes: add(l,who,t.replace('Wayan',h))
# all other game texts (hints, cards, facts): narrator voice Opa Ketut; skip what already has a voice
_man0=json.load(open(OUT+'/manifest.json'))
story_keys=set(jobs)
for de in list(D['en'].keys()):
    if '${' in de: continue
    for l in ('de','en','id'):
        t=T(de,l)
        for x in split(t):
            k=norm(x)
            if len(x)<2 or not k or re.fullmatch(r'[A-ZÄÖÜ0-9 ·/\-–%.]+',x) or re.search(r'\d+/\d+',x): continue
            if (l,'kakek',k) in jobs: continue
            have=_man0.get(l,{})
            if k in have.get('kakek',{}) or k in have.get('thalassa',{}): continue
            if '·' in x or (l!='de' and t.strip()==de.strip()): continue
            jobs[(l,'kakek',k)]=x
VOICE={'kakek':'Algenib','baruna':'Algieba','wayan':'Puck','ayu':'Leda'}
STY={'kakek':'warm, calm, slow and gentle old Balinese grandfather telling a story to his grandchild, slightly raspy, smiling',
 'baruna':'deep, slow, calm, wise and gentle ancient voice of the ocean god, mysterious but kind, speaking softly to a child',
 'wayan':'playful, upbeat, excited eight-year-old boy, bright, smiling',
 'ayu':'cheerful, curious, excited eight-year-old girl, bright and sweet, smiling'}
LANGN={'de':'German','en':'English','id':'Indonesian (Bahasa Indonesia)'}
ROT=['gemini-3.8-flash-tts','gemini-3.8-flash-lite-tts','gemini-3.1-flash-tts-preview','gemini-2.5-flash-preview-tts']; dead=set()
def fname(l,who,s): return f'{l}/{who[0]}3_{hashlib.md5(("v3|"+who+"|"+s).encode()).hexdigest()[:10]}.mp3'
todo=[(k,s) for k,s in jobs.items() if not os.path.exists(OUT+'/'+fname(k[0],k[1],s))]
LO={'de':0,'en':1,'id':2}
todo.sort(key=lambda kv:(LO[kv[0][0]], 0 if kv[0] in story_keys else 1, kv[0][1]))
print('jobs',len(jobs),'todo',len(todo),'story todo',sum(1 for k,_ in todo if k in story_keys),flush=True)
def silences(pcm):
    with tempfile.NamedTemporaryFile(suffix='.pcm',delete=False) as f: f.write(pcm); p=f.name
    r=subprocess.run(['ffmpeg','-hide_banner','-f','s16le','-ar','24000','-ac','1','-i',p,'-af','silencedetect=noise=-38dB:d=0.4','-f','null','-'],capture_output=True,text=True)
    st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',r.stderr)]; en_=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',r.stderr)]
    return p,list(zip(st,en_))
def encode(pcmfile,t0,t1,out,who):
    os.makedirs(os.path.dirname(out),exist_ok=True)
    af='silenceremove=start_periods=1:start_threshold=-46dB,areverse,silenceremove=start_periods=1:start_threshold=-46dB,areverse'
    if who=='wayan': af='rubberband=pitch=1.1:formant=shifted:pitchq=quality,'+af
    if who=='ayu': af='rubberband=pitch=1.08:formant=shifted:pitchq=quality,'+af
    if who=='baruna': af='rubberband=pitch=0.88:pitchq=quality,atempo=0.92,aecho=0.8:0.6:70|140:0.3|0.18,'+af
    if who=='kakek': af='rubberband=pitch=0.93:pitchq=quality,atempo=0.93,'+af
    subprocess.run(['ffmpeg','-y','-loglevel','error','-f','s16le','-ar','24000','-ac','1','-ss',f'{t0:.3f}','-to',f'{t1:.3f}','-i',pcmfile,'-af',af,'-b:a','56k',out],check=True)
tokens=[0]; fails=[]
def batch(items, depth=0):
    (l,who,_),_s=items[0]
    text=' <long pause> '.join(s if re.search(r'[.!?:]$',s) else s+'.' for _,s in items)
    pcm=None; info=None
    for attempt in range(14):
        live=[m for m in ROT if m not in dead]
        if not live: print('ALL MODELS EXHAUSTED',flush=True); break
        mdl=live[0]
        sty=STY[who]+f'. Speak in {LANGN[l]}.'
        pcm,info=tts_pcm(text,VOICE[who],sty if mdl.startswith('gemini-3.8') else None,mdl)
        if pcm: break
        if isinstance(info,str) and (info.startswith('404') or info.startswith('400') or ('429' in info[:4] and ('per day' in info or 'PerDay' in info))):
            print('model off',mdl,info[:90],flush=True); dead.add(mdl); continue
        if isinstance(info,str) and info.startswith('429'):
            m=re.search(r'retry in (\d+)s',info); time.sleep((int(m.group(1)) if m else 20)+2); continue
        break
    if not pcm: print('ERR',l,who,str(info)[:120],flush=True); fails.extend(items); return
    tokens[0]+=info if isinstance(info,int) else 0
    dur=len(pcm)/48000; p,sil=silences(pcm); n=len(items)
    if n==1: cuts=[]
    else:
        inner=[(e-s,(s+e)/2) for s,e in sil if s>0.2 and e<dur-0.2]
        if len(inner)<n-1:
            os.remove(p)
            if n>=2 and depth<4: h=max(1,n//2); batch(items[:h],depth+1); batch(items[h:],depth+1)
            else: fails.extend(items)
            return
        cuts=sorted(m for _,m in sorted(inner,reverse=True)[:n-1])
    bounds=[0]+cuts+[dur]
    for i,(k,s) in enumerate(items):
        d=bounds[i+1]-bounds[i]; cps=len(s)/max(d,.1)
        if (cps<4 or cps>30) and n>1 and depth<4:
            os.remove(p); h=max(1,n//2); batch(items[:h],depth+1); batch(items[h:],depth+1); return
    for i,(k,s) in enumerate(items): encode(p,bounds[i],bounds[i+1],OUT+'/'+fname(k[0],k[1],s),k[1])
    os.remove(p); print('ok',l,who,n,flush=True)
B=[]; cur=[]
for k,s in todo:
    if cur and (cur[0][0][:2]!=k[:2] or len(cur)>=8): B.append(cur); cur=[]
    cur.append((k,s))
if cur: B.append(cur)
def run(b):
    if len(dead)>=len(ROT): fails.extend(b); return
    batch(b)
with ThreadPoolExecutor(3) as ex: list(ex.map(run,B))
man=json.load(open(OUT+'/manifest.json'))
for (l,who,k),s in jobs.items():
    f=fname(l,who,s)
    if os.path.exists(OUT+'/'+f): man.setdefault(l,{}).setdefault(who,{})[k]=f
json.dump(man,open(OUT+'/manifest.json','w'),ensure_ascii=False)
done=sum(1 for (l,who,k),s in jobs.items() if os.path.exists(OUT+'/'+fname(l,who,s)))
print('DONE',done,'of',len(jobs),'fails',len(fails),'audio_tokens',tokens[0],'cost_usd',round(tokens[0]/1e6*6,3),flush=True)
