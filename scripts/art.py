"""Generate Apogee's original pixel sprites and range panorama. Optional: Pillow."""
from PIL import Image, ImageDraw
from pathlib import Path
import math, random
out=Path(__file__).resolve().parents[1]/'public'/'art'
out.mkdir(exist_ok=True,parents=True)
rng=random.Random(1711)
W,H=600,260
def rgb(c): return tuple(bytes.fromhex(c.lstrip('#')))
def blend(a,b,t): return tuple(round(x*(1-t)+y*t) for x,y in zip(a,b))
im=Image.new('RGB',(W,H)); d=ImageDraw.Draw(im)
stops=[(0,'10192e'),(.24,'1b2d48'),(.48,'39556e'),(.63,'7c8290'),(.74,'cc9d8a'),(.82,'e8b18c'),(1,'d29277')]
for y in range(H):
    t=y/H
    for (l,a),(u,b) in zip(stops,stops[1:]):
        if t<=u:
            d.line((0,y,W,y), fill=blend(rgb(a),rgb(b),round((t-l)/(u-l)*28)/28)); break
for i in range(225):
    x=rng.randrange(W); y=rng.randrange(162)
    col=blend(im.getpixel((x,y)),rgb('e1e2db'),rng.uniform(.17,.72)*(1-y/210))
    d.point((x,y),fill=col)
    if i%39==0: d.line((x-1,y,x+1,y),fill=col);d.line((x,y-1,x,y+1),fill=col)
# An illuminated crescent with a darkened limb and crater shading.
mx,my,rad=431,62,21
craters=[(-6,4,4),(4,-9,3),(7,5,5),(-3,-12,2),(1,12,2)]
for y in range(-rad,rad+1):
    for x in range(-rad,rad+1):
        if x*x+y*y>=rad*rad:continue
        z=math.sqrt(1-(x*x+y*y)/(rad*rad))
        light=max(0,(-x*.75-y*.18)/rad-z*.28)
        c=blend(rgb('354860'),rgb('ded1ae'),min(1,light*1.75))
        for cx,cy,rr in craters:
            if (x-cx)**2+(y-cy)**2<rr**2:c=blend(c,rgb('4f5a66'),.27)
        d.point((mx+x,my+y),fill=c)
# Long wind-torn cloud banks, low on the horizon.
for x,y,size in [(29,129,59),(422,141,87),(304,120,45),(121,157,95),(493,103,31),(282,150,34)]:
    for i in range(size):
        xx=int(rng.gauss(x,size/2.7)); yy=round(rng.gauss(y,2.3))
        if 0<=xx<W:
            col=blend(im.getpixel((xx,yy)),rgb('e0bcaa'),rng.uniform(.05,.36))
            d.line((xx,yy,xx+rng.randint(3,24),yy),fill=col)
im.save(out/'dusk.png')
space=Image.new('RGB',(W,H),'#080f20');d=ImageDraw.Draw(space)
for i in range(700):
    x,y=rng.randrange(W),rng.randrange(H)
    d.point((x,y),fill=rng.choice(['#23364d','#405770','#818d9e','#aaaebb']))
space.save(out/'space.png')
# Multi-plane ridgelines with shadowed gullies and warm, broken cliff strata.
im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
def ridge(base,amp,step,main,shade,lit):
    pts=[(x,int(base+rng.uniform(-amp,amp))) for x in range(-step,W+step,step)]
    trace=[]
    for (x,y),(xx,yy) in zip(pts,pts[1:]):
        for k in range(x,xx):
            trace.append((k,round(y+(yy-y)*(k-x)/step+1.4*math.sin(k*.42))))
    d.polygon(trace+[(W,H),(0,H)],fill=main)
    for (x,y),(xx,yy) in zip(pts,pts[1:]):
        if yy>y:d.polygon([(x,y+1),(xx,yy+1),(xx+6,yy+12),(x+5,y+8),(x+12,y+14)],fill=shade)
        else:d.line([(x,y+1),(xx,yy+1)],fill=lit,width=1)
    for i in range(1500):
        x=rng.randrange(W); yy=trace[x+step][1]+rng.randint(2,31)
        d.line((x,yy,x+rng.randint(0,6),yy),fill=rng.choice([shade,main,lit]))
ridge(175,12,30,'#9c8584','#968081','#ac9190')
ridge(190,21,36,'#70697b','#62647a','#8b7883')
ridge(206,16,20,'#4f5469','#454d64','#676478')
ridge(218,8,34,'#303b50','#303a50','#515365')
# Service sheds, pad track and runway lights.
for x,y,w,h in [(25,228,49,8),(36,224,15,12),(475,228,32,8),(514,224,37,12),(492,220,5,17)]:
    d.rectangle((x,y,x+w,y+h),fill='#283747');d.line((x,y,x+w,y),fill='#75808a')
    for xx in range(x+3,x+w-2,6): d.line((xx,y+3,xx+2,y+3),fill='#ba9769')
d.rectangle((0,237,W,259),fill='#202c3a')
for i in range(900):
    x,y=rng.randrange(W),rng.randrange(238,260)
    d.line((x,y,x+rng.randint(1,8),y),fill=rng.choice(['#2a3542','#35404c','#192633']))
for y in [240,246]:
    d.line((0,y,W,y),fill='#48505a')
    for x in range(5,W,22): d.point((x,y-1),fill='#edbd75')
im.save(out/'range.png')
# Narrow lattice tower, lightning mast, decks, lamps and access arm.
im=Image.new('RGBA',(68,115));d=ImageDraw.Draw(im)
d.line((25,0,25,13),fill='#a29088');d.point((25,0),fill='#ff8068')
d.rectangle((23,12,27,22),fill='#53535a')
for yy in range(23,108,10):
    d.line((17,yy,32,yy+9),fill='#a48371',width=2)
    d.line((32,yy,17,yy+9),fill='#51545e',width=2)
    d.rectangle((14,yy,35,yy+2),fill='#414951')
    d.line((14,yy,35,yy),fill='#af8d76')
for x,c in [(16,'#53525a'),(18,'#af907a'),(31,'#424552'),(33,'#997e72')]:d.line((x,22,x,110),fill=c,width=2)
for yy in range(24,106,4):d.line((20,yy,23,yy),fill='#b69c87')
for yy,end in [(30,57),(62,60),(88,53)]:
    d.rectangle((30,yy,end,yy+4),fill='#484c57')
    d.line((30,yy,end,yy),fill='#d1b199')
    d.line((33,yy+12,end-3,yy+4),fill='#575763',width=2)
    d.point((end,yy-1),fill='#ffd68b')
d.rectangle((5,108,44,114),fill='#333c49');d.line((5,108,44,108),fill='#a98c79')
im.save(out/'tower.png')
def rocket(upper):
    im=Image.new('RGBA',(28,76));d=ImageDraw.Draw(im)
    d.polygon([(14,1),(17,8),(19,14),(19,24),(9,24),(9,14),(11,8)],fill='#dce2d7')
    d.line((14,1,9,15),fill='#ffeed0');d.line((17,8,19,15),fill='#9297a0',width=2)
    d.rectangle((10,15,18,35),fill='#d4d4c7');d.rectangle((16,16,19,35),fill='#8b9199')
    d.rectangle((9,24,19,26),fill='#de825c');d.rectangle((12,13,15,15),fill='#32485a')
    d.line((11,28,11,33),fill='#fff2cc')
    if upper:
        d.rectangle((10,36,18,37),fill='#414855');d.polygon([(12,38),(16,38),(18,41),(10,41)],fill='#849099')
        im=im.crop((0,0,28,42))
    else:
        d.rectangle((9,36,19,39),fill='#424c5a')
        d.rectangle((8,40,20,64),fill='#cfd1c9')
        d.rectangle((17,40,20,64),fill='#858e98');d.line((9,40,9,63),fill='#fff0d2')
        d.rectangle((8,42,20,45),fill='#d98255')
        for x in [11,14,17]:d.line((x,54,x,63),fill='#a4a8ab')
        for poly in [[(8,54),(2,66),(2,71),(9,67)],[(20,54),(25,66),(25,71),(19,67)]]:d.polygon(poly,fill='#c57752')
        d.rectangle((8,65,20,68),fill='#4c5762')
        for x in [8,15]:d.polygon([(x+1,69),(x+4,69),(x+6,73),(x,73)],fill='#99988c')
    im.save(out/('upper.png' if upper else 'vehicle.png'))
rocket(False);rocket(True)
# App icon: orbital arc and forward-pointing vessel on a dark field.
for n in (192,512):
    im=Image.new('RGB',(256,256),'#121e29');d=ImageDraw.Draw(im)
    d.arc((34,75,228,181),22,310,fill='#6fb6af',width=7)
    d.polygon([(174,48),(151,184),(127,148),(88,151)],fill='#efad72')
    im.resize((n,n),Image.Resampling.LANCZOS).save(out.parent/f'icon-{n}.png')
