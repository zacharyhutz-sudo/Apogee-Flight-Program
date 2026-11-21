"""Generate the original Earth range pixel atlas, including three facility tiers."""
from PIL import Image,ImageDraw
from pathlib import Path
from random import Random
out=Path(__file__).resolve().parents[1]/'public/art/site.png'
W,H=80,104
atlas=Image.new('RGBA',(W*8,H*3))
def frame(index):
 global im,d
 im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im);return Random(index+172)
def put(index):atlas.paste(im,(index%8*W,index//8*H))
def iso(x,y,z=0):return (round(40+x-y),round(80+(x+y)*.5-z))
def face(coords,color):d.polygon([iso(*p) for p in coords],fill=color)
def line(a,b,c,w=1):d.line((iso(*a),iso(*b)),fill=c,width=w)
def box(x,y,w,h,z,ht,colors):
 a,b=x+w,y+h;top=z+ht
 face([(x,b,z),(a,b,z),(a,b,top),(x,b,top)],colors[1]);face([(a,y,z),(a,b,z),(a,b,top),(a,y,top)],colors[2]);face([(x,y,top),(a,y,top),(a,b,top),(x,b,top)],colors[0])
def tank(x,y,z,w,h):
 cx,cy=iso(x,y,z);r=w//3
 d.ellipse((cx-w,cy-r,cx+w,cy+r),fill='#546c72');d.rectangle((cx-w,cy-h,cx+w,cy),fill='#869da0')
 for k,c in [(1,'#b1c2ba'),(4,'#a5bab4'),(w,'#78979a'),(w*2-3,'#57787e')]:
  d.line((cx-w+k,cy-h,cx-w+k,cy),fill=c,width=2)
 for dy in [2, h-2]:d.arc((cx-w,cy-dy-r,cx+w,cy-dy+r),0,180,fill='#405b63')
 d.ellipse((cx-w,cy-h-r,cx+w,cy-h+r),fill='#c5d0be',outline='#8ca6a2')
# Tiles all use identical anchors so that overlays and hit testing agree.
for i in range(8):
 r=frame(i)
 if i==7:
  d.line((20,77,29,77,31,76,39,76),fill='#426875');d.line((47,85,52,85),fill='#40606c');put(i);continue
 green=['#6f927c','#749280','#7c9881','#708f7a']
 box(-16,-16,32,32,-7,7,(green[i%4],'#595c53','#455250'))
 for j in range(83):
  x=r.randint(-15,15);y=r.randint(-15,15)
  line((x,y,0),(min(x+1,15),y,0),r.choice(['#89927b','#818d75','#738471','#6b7f6c']))
 if i==4:
  face([(-16,-10,0),(16,-10,0),(16,10,0),(-16,10,0)],'#626e6c')
  line((-16,10,0),(16,10,0),'#a8b3a4');line((-16,-10,0),(16,-10,0),'#a8b3a4')
  for x in range(-16,16,9):line((x,0,0),(x+4,0,0),'#b5ad90')
 if i==6:
  for x,y,h in [(-6,-6,17),(5,-4,20),(-9,4,13),(3,8,19)]:
   cx,cy=iso(x,y);d.line((cx,cy,cx,cy-8),fill='#5c6154',width=2)
   for dh in (0,4,8):
    width=7-dh//3
    d.polygon([(cx,cy-h+dh//2),(cx-width,cy-5-dh//2),(cx+width,cy-5-dh//2)],fill='#416e63')
    d.polygon([(cx,cy-h+dh//2),(cx-width,cy-5-dh//2),(cx-1,cy-6-dh//2)],fill='#638b70')
 if i==5:
  for x,y,w,h in [(-5,-6,8,8),(4,1,7,6),(-8,5,6,4)]:
   cx,cy=iso(x,y);d.polygon([(cx-w,cy),(cx-w+2,cy-h),(cx+2,cy-h-2),(cx+w,cy-2),(cx+3,cy+1)],fill='#92978b');d.polygon([(cx+2,cy-h-2),(cx+w,cy-2),(cx+3,cy+1)],fill='#667977')
 put(i)
for typ in range(4):
 for tier in range(3):
  idx=8+typ*3+tier;r=frame(idx)
  box(-13,-13,26,26,0,2,('#bac0af','#6d8284','#52666d'))
  steel=('#a4adb0','#637982','#485f6a');light=('#d3d4bc','#a4ac9c','#84978e')
  if typ==0:
   box(-11,-10,22,20,2,9,steel);box(-10,-9,20,18,11,2,light)
   box(-8,-8,14,15,13,6,('#b7c2b9','#677d80','#4d666e'))
   for x in [-8,-4,0,4]:line((x,10,8),(x+2,10,8),'#90d0ce',2)
   cx,cy=iso(-3,-4,23);d.line((cx+2,cy+5,cx+1,cy-1),fill='#546a72',width=3)
   d.polygon([(cx-8,cy-5),(cx+8,cy-12),(cx+6,cy-5),(cx,cy-1),(cx-5,cy-2)],fill='#e0dbc4');d.line((cx-8,cy-5,cx+8,cy-12),fill='#849ba1');d.line((cx,cy-6,cx-2,cy-12),fill='#d8cbb1')
  elif typ==1:
   box(-13,-13,26,26,2,3,('#636f73','#495861','#374958'))
   for k in [-11,-5,1,7]:line((k,11,5),(k+3,11,5),'#e5b16f',2)
   x,y=iso(-9,6,5)
   d.rectangle((x-3,y-38,x+3,y),fill='#475864')
   for k in range(5,39,6):
    d.line((x-3,y-k,x+3,y-k-4),fill='#c5a789');d.line((x-3,y-k-4,x+3,y-k-4),fill='#d7bc97')
   for k in [17,28]:d.line((x,y-k,x+10,y-k),fill='#a4a6a0',width=2)
   x,y=iso(4,-1,5)
   d.polygon([(x,y-38),(x+4,y-29),(x+4,y-6),(x+7,y-1),(x-7,y-1),(x-4,y-6),(x-4,y-29)],fill='#d4dbce')
   d.rectangle((x+2,y-28,x+3,y-4),fill='#8ca1a1');d.line((x-3,y-19,x+3,y-19),fill='#e39c65',width=3)
  elif typ==2:
   for x,y in [(-7,-5),(6,1),(-4,8)]:tank(x,y,2,6,15+tier*2)
   line((-10,10,2),(7,10,2),'#d59962',2)
  else:
   box(-12,-10,22,20,2,10,light);box(-13,-11,24,22,12,2,steel)
   cx,cy=iso(-3,-2,14)
   d.pieslice((cx-9,cy-13,cx+9,cy+9),180,360,fill='#a2c5c5',outline='#698b97')
   d.arc((cx-4,cy-12,cx+4,cy+9),180,360,fill='#d6ddd1')
   for k in [-8,-3,2]:line((k,10,8),(k+3,10,8),'#577a81',2)
  for i in range(tier+1):box(10-i*4,12,2,2,2,2,('#f9ce8c','#c8935c','#855d43'))
  if tier>=1 and typ!=2:box(8,-12,4,4,2,5+tier*2,steel)
  if tier==2:
   x,y=iso(-11,-9,2);d.line((x,y,x,y-29),fill='#a7b3aa');d.point((x,y-30),fill='#ffb270')
  put(idx)
# Small launch-range fixtures sit beside the access road.
r=frame(20)
cx,cy=iso(0,0)
d.line((cx,cy,cx,cy-11),fill='#5b7377',width=2)
d.line((cx,cy-11,cx+4,cy-13),fill='#aabbb1',width=2)
d.line((cx+4,cy-13,cx+6,cy-13),fill='#f4d295',width=2)
put(20)
atlas.save(out)
