import sys, colorsys
from PIL import Image, ImageFilter
src=Image.open(sys.argv[1]).convert('RGBA')
S=3
def layer(name, box, test):
  im=src.crop(box); W,H=im.size; px=im.load()
  out=Image.new('L',(W,H),255)
  for y in range(H):
    for x in range(W):
      r,g,b,a=px[x,y]
      if a<128: continue
      h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
      if test(h,s,v): out.putpixel((x,y),0)
  out=out.resize((W*S,H*S),Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2)).point(lambda p:0 if p<128 else 255)
  out.save(name+'.png'); out.convert('1').save(name+'.pbm')
brown=lambda h,s,v:(h<0.13 or h>0.95) and s>0.25 and v<0.75
layer('hawk-sil',(470,95,900,420),brown)
layer('hawk-eng',(470,95,900,420),lambda h,s,v: brown(h,s,v) and v<0.40)
badge=(395,95,1080,680)
layer('badge-dark',badge,lambda h,s,v: v<0.42)
layer('badge-mid',badge,lambda h,s,v: v<0.62 and not v<0.42)
