// Raymarched heightfield terrain, rendered ONCE into a canvas in horizontal bands.
// window.renderTerrain(canvas, opts) -> Promise. Sky pixels can be transparent (opts.transparentSky)
// so a layer (the wolf) can sit between the sky and the mountains.
(function () {
  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uMoon; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uFog;
uniform vec3 uMoonCol; uniform vec3 uRock; uniform vec3 uSnow; uniform vec3 uRim; uniform float uSeed;
uniform vec3 uCam; uniform vec3 uLook; uniform float uFocal; uniform float uMist; uniform float uExposure;
uniform float uTransparentSky; uniform float uStars; uniform float uMoonDisk; uniform float uSnowLine; uniform float uFreq; uniform float uHeight; uniform float uGlow; uniform float uPow; uniform vec3 uMoonSky; uniform float uSkyCurve; uniform vec2 uLoop; uniform float uPhase; uniform float uMistDrift;
out vec4 o;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21) + uSeed); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 noised(vec2 x){
  vec2 f = fract(x); vec2 u = f*f*(3.0-2.0*f); vec2 du = 6.0*f*(1.0-f); vec2 p = floor(x);
  float a = hash(p), b = hash(p+vec2(1,0)), c = hash(p+vec2(0,1)), d = hash(p+vec2(1,1));
  return vec3(a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y, du*(vec2(b-a,c-a)+(a-b-c+d)*u.yx));
}
const mat2 m2 = mat2(0.8,-0.6,0.6,0.8);
float vnoise(vec2 x){ vec2 f = fract(x); vec2 u = f*f*(3.0-2.0*f); vec2 p = floor(x);
  float a = hash(p), b = hash(p+vec2(1,0)), c = hash(p+vec2(0,1)), d = hash(p+vec2(1,1));
  return a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y; }
float terrain(vec2 x, int oct){
  vec2 p = x*uFreq;
  float base = 0.6*vnoise(p*0.33) + 0.4*vnoise(m2*p*0.71 + 3.1);
  float r = 0.0, amp = 0.55, prev = 1.0; vec2 q = p + vec2(vnoise(p*0.5), vnoise(p*0.5 + 7.7))*0.6;
  for (int i = 0; i < 14; i++) { if (i >= oct) break;
    float n = 1.0 - abs(vnoise(q)*2.0 - 1.0); n *= n;
    r += n*amp*prev; prev = clamp(n*1.25, 0.0, 1.0); amp *= 0.47; q = m2*q*2.07; }
  float h = pow(base, uPow)*(0.25 + 1.35*r);
  return uHeight*h - uHeight*0.22;
}
int lod(float t){ return int(clamp(13.0 - log2(max(t, 1.0)/120.0)*1.6, 5.0, 13.0)); }
float march(vec3 ro, vec3 rd){
  float t = 1.0;
  for (int i = 0; i < 700; i++) {
    vec3 p = ro + t*rd; float h = p.y - terrain(p.xz, lod(t)-3);
    if (abs(h) < 0.0008*t || t > 14000.0) break;
    t += 0.3*h;
  }
  return t;
}
vec3 normalAt(vec3 p, float t, int oct){
  vec2 e = vec2(0.0012*t + 0.2, 0.0);
  return normalize(vec3(terrain(p.xz-e.xy,oct)-terrain(p.xz+e.xy,oct), 2.0*e.x, terrain(p.xz-e.yx,oct)-terrain(p.xz+e.yx,oct)));
}
float shadow(vec3 ro, vec3 rd){
  float res = 1.0, t = 2.0;
  for (int i = 0; i < 80; i++) { vec3 p = ro + t*rd; float h = p.y - terrain(p.xz, 6); res = min(res, 16.0*h/t); t += clamp(h, 6.0, 160.0); if (res < 0.001 || t > 6000.0) break; }
  return clamp(res, 0.0, 1.0);
}
vec3 sky(vec3 rd){
  float y = max(rd.y, 0.0);
  vec3 c = mix(uSkyHor, uSkyTop, pow(y, uSkyCurve));
  float m = max(dot(rd, uMoonSky), 0.0);
  c += uMoonCol*uGlow*(0.18*pow(m, 6.0) + 0.5*pow(m, 160.0));
  c += uMoonCol*smoothstep(1.0-uMoonDisk, 1.0-uMoonDisk*0.82, m)*3.0;
  if (rd.y > 0.0 && uStars > 0.0) {
    vec2 g = rd.xz/(rd.y+0.25)*320.0; vec2 id = floor(g); float h = hash(id);
    vec2 f = fract(g) - 0.5 - 0.35*(vec2(hash(id+7.1), hash(id+3.3))-0.5);
    float s = smoothstep(0.08, 0.0, length(f))*step(0.965, h)*(0.4 + 0.6*hash(id+1.7));
    s *= 0.65 + 0.35*sin(6.2831853*(uPhase*2.0 + hash(id+9.3)));
    c += vec3(0.85, 0.9, 1.0)*s*uStars*smoothstep(0.02, 0.25, rd.y)*(1.0 - 0.8*pow(m, 6.0));
  }
  return c;
}
void main(){
  vec2 q = gl_FragCoord.xy/uRes; vec2 p = (2.0*gl_FragCoord.xy - uRes)/uRes.y;
  vec3 ro = uCam; ro.y += terrain(ro.xz, 3);
  vec3 ta = uLook; ta.y += ro.y;
  vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0,1,0))), vv = cross(uu, ww);
  vec3 rd = normalize(p.x*uu + p.y*vv + uFocal*ww);
  float t = march(ro, rd);
  vec3 col; float alpha = 1.0;
  if (t > 14000.0) {
    col = sky(rd);
    if (uTransparentSky > 0.5) alpha = 0.0;
  } else {
    vec3 pos = ro + t*rd; vec3 n = normalAt(pos, t, lod(t)); vec3 ns = normalAt(pos, t*3.0, 6);
    float slope = ns.y;
    float nv = vnoise(pos.xz*0.012) + 0.5*vnoise(pos.xz*0.03)*exp(-t*0.0006);
    float sn = smoothstep(0.68, 0.86, slope + 0.2*(nv - 0.75)) * smoothstep(uSnowLine - 60.0, uSnowLine + 60.0, pos.y + 40.0*nv);
    float strata = 0.75 + 0.5*vnoise(vec2(pos.y*0.06 + vnoise(pos.xz*0.004)*3.0, pos.x*0.001));
    vec3 alb = mix(uRock*strata*(0.7 + 0.6*vnoise(pos.xz*0.01)), uSnow, sn);
    float ao = clamp(1.0 + (terrain(pos.xz, lod(t)) - terrain(pos.xz, 4))*0.0045, 0.35, 1.15);
    float dif = clamp(dot(n, uMoon), 0.0, 1.0);
    float sh = dif > 0.001 ? shadow(pos + n*3.0, uMoon) : 0.0;
    float amb = 0.5 + 0.5*n.y;
    float rim = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 4.0)*clamp(dot(rd, uMoon)*0.5 + 0.6, 0.0, 1.0);
    vec3 lin = uMoonCol*dif*sh*1.7 + uSkyTop*amb*1.1*ao + uRim*rim*0.22*ao + uFog*0.12*clamp(-n.y + 0.5, 0.0, 1.0);
    col = alb*lin*mix(1.0, ao, 0.6);
    // distance haze, then valley mist that hugs low ground
    float fo = 1.0 - exp(-0.00016*t);
    col = mix(col, uFog, fo);
    float mn = 0.6*vnoise(pos.xz*0.0011 + uLoop*uMistDrift) + 0.4*vnoise(pos.xz*0.0029 - uLoop*uMistDrift*0.75 + 5.0);
    float mist = uMist*(0.3 + 0.8*mn)*exp(-max(pos.y - uHeight*0.02 - 60.0*mn, 0.0)*0.012)*(1.0 - exp(-0.0008*t));
    col = mix(col, uFog*1.05, clamp(mist, 0.0, 0.88));
  }
  col = 1.0 - exp(-col*uExposure);
  col = pow(col, vec3(0.4545));
  col *= 0.75 + 0.25*pow(16.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), 0.15);
  col += (hash(gl_FragCoord.xy*0.37) - 0.5)/255.0*3.0;
  o = vec4(col*alpha, alpha);
}`;
  const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map((c) => Math.pow(c, 2.2)); };
  const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

  window.renderTerrain = function (canvas, o = {}) {
    const opts = Object.assign({
      scale: 1, seed: 0.13, cam: [0, 220, 0], look: [0, 120, 2000], focal: 1.8,
      moon: [-0.9, 0.38, 0.25], skyTop: '#06102A', skyHor: '#1B3556', fog: '#1C3352', moonCol: '#9DB4E6',
      rock: '#20242E', snow: '#C9D6EE', rim: '#7FA6FF', mist: 0.9, exposure: 1.6, transparentSky: false,
      stars: 1, moonDisk: 0.00035, snowLine: 120, bands: 24, freq: 0.0011, height: 700, glow: 0.6, pow: 1.6, skyCurve: 0.45, phase: 0, mistDrift: 2.2, moonSky: [0.35, 0.36, 1],
    }, o);
    const dpr = Math.min(2, window.devicePixelRatio || 1) * opts.scale;
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    canvas.width = w; canvas.height = h;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: true, alpha: true });
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    gl.uniform2f(U('uRes'), w, h); gl.uniform3fv(U('uMoon'), norm(opts.moon)); gl.uniform3fv(U('uMoonSky'), norm(opts.moonSky || opts.moon));
    for (const [k, v] of [['uSkyTop', opts.skyTop], ['uSkyHor', opts.skyHor], ['uFog', opts.fog], ['uMoonCol', opts.moonCol], ['uRock', opts.rock], ['uSnow', opts.snow], ['uRim', opts.rim]]) gl.uniform3fv(U(k), hex(v));
    gl.uniform1f(U('uSeed'), opts.seed); gl.uniform3fv(U('uCam'), opts.cam); gl.uniform3fv(U('uLook'), opts.look);
    gl.uniform1f(U('uFocal'), opts.focal); gl.uniform1f(U('uMist'), opts.mist); gl.uniform1f(U('uExposure'), opts.exposure);
    gl.uniform1f(U('uTransparentSky'), opts.transparentSky ? 1 : 0); gl.uniform1f(U('uStars'), opts.stars);
    gl.uniform1f(U('uMoonDisk'), opts.moonDisk); gl.uniform1f(U('uSnowLine'), opts.snowLine);
    gl.uniform1f(U('uFreq'), opts.freq); gl.uniform1f(U('uHeight'), opts.height); gl.uniform1f(U('uGlow'), opts.glow); gl.uniform1f(U('uPow'), opts.pow); gl.uniform1f(U('uSkyCurve'), opts.skyCurve); gl.uniform2f(U('uLoop'), Math.cos(opts.phase * 6.2831853), Math.sin(opts.phase * 6.2831853)); gl.uniform1f(U('uPhase'), opts.phase); gl.uniform1f(U('uMistDrift'), opts.mistDrift);
    gl.viewport(0, 0, w, h); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const band = Math.ceil(h / opts.bands);
    return new Promise((resolve) => {
      let y = 0;
      const step = () => {
        gl.scissor(0, y, w, band); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish();
        y += band;
        if (y < h) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });
  };
})();
