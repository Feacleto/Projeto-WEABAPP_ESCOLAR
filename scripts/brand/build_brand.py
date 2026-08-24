#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Gera TODOS os assets de marca do Alô Buzinou a partir de UMA geometria.

    python scripts/brand/build_brand.py

POR QUE UM GERADOR, E NÃO ARQUIVOS DESENHADOS À MÃO
O mark aparece em nove tamanhos e cinco combinações de cor (ícone do PWA,
favicon, badge monocromático de notificação, hero escuro, relatório impresso).
Desenhar cada um separado garante divergência — foi exatamente o que aconteceu
com o ícone e o wordmark que saíram do gerador de imagem: a mesma marca em
dois desenhos diferentes, um sólido e um contornado. Aqui a geometria existe
uma vez, em espaço de design, e cada arquivo é uma projeção dela.

O texto do wordmark NÃO depende de webfont: as letras do Nunito 900 viram
path (fontTools). Assim o logo sai idêntico no PDF do relatório, no preview
do WhatsApp e no celular do pai que está offline.
"""

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'public', 'brand')
JSOUT = os.path.join(ROOT, 'src', 'components', 'common', 'logoPaths.js')
FONT_PATH = os.path.join(HERE, 'fonts', 'Nunito.ttf')
os.makedirs(OUT, exist_ok=True)

SS = 8  # supersample: desenha grande e reduz, que é o antialias mais limpo

# ─────────── paleta (espelha tailwind.config.js) ───────────
EMERALD = '#1F5F3F'
GREEN = '#52C41A'
NEAR_BLACK = '#0B1210'
WHITE = '#FFFFFF'


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgba(h, a=255):
    return rgb(h) + (a,)


TRANSPARENT = (0, 0, 0, 0)

# ─────────── geometria, em espaço de design ───────────
# Frente da perua = retângulo arredondado; janela = balão de fala; as ondas da
# buzina saem do canto superior direito, POR FORA da carroceria (o raio do
# canto abre a folga na diagonal).
BODY = (0, 74, 360, 298, 58)                       # x, y, w, h, raio
WHEELS = [(32, 356, 52, 56, 18), (276, 356, 52, 56, 18)]
BUBBLE = (52, 126, 256, 170, 44)
TAIL = [(200, 268), (268, 268), (256, 348)]        # rabicho do balão
TAIL_R = 12
ARC_C = (314, 126)                                 # centro virtual das ondas
ARC_RR = (70, 126)                                 # raio interno e externo
ARC_W = 20                                         # espessura do traço
ARC_A = (272, 358)                                 # varredura (0 grau = leste, y p/ baixo)


# ─────────── vetor 2D mínimo ───────────
def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _mul(a, k):
    return (a[0] * k, a[1] * k)


def _len(a):
    return math.hypot(a[0], a[1])


def _norm(a):
    n = _len(a)
    return (a[0] / n, a[1] / n) if n else (0.0, 0.0)


def arc_points(c, r, a0, a1, step=1.5):
    n = max(2, int(abs(a1 - a0) / step) + 1)
    return [
        (c[0] + r * math.cos(math.radians(a0 + (a1 - a0) * i / (n - 1))),
         c[1] + r * math.sin(math.radians(a0 + (a1 - a0) * i / (n - 1))))
        for i in range(n)
    ]


def corners(pts, r):
    """Cantos arredondados de um polígono: (entrada, saída, centro, raio, ang0, ang1)."""
    out = []
    n = len(pts)
    for i in range(n):
        prev, p, nxt = pts[(i - 1) % n], pts[i], pts[(i + 1) % n]
        v1, v2 = _norm(_sub(prev, p)), _norm(_sub(nxt, p))
        ang = math.acos(max(-1.0, min(1.0, v1[0] * v2[0] + v1[1] * v2[1])))
        if ang < 1e-6 or abs(ang - math.pi) < 1e-6:
            out.append((p, p, p, 0, 0, 0))
            continue
        tan = min(r / math.tan(ang / 2), _len(_sub(prev, p)) / 2, _len(_sub(nxt, p)) / 2)
        rr = tan * math.tan(ang / 2)
        a, b = _add(p, _mul(v1, tan)), _add(p, _mul(v2, tan))
        bis = _norm(_add(v1, v2))
        c = _add(p, _mul(bis, rr / math.sin(ang / 2)))
        a0 = math.degrees(math.atan2(a[1] - c[1], a[0] - c[0]))
        a1 = math.degrees(math.atan2(b[1] - c[1], b[0] - c[0]))
        while a1 - a0 > 180:
            a1 -= 360
        while a1 - a0 < -180:
            a1 += 360
        out.append((a, b, c, rr, a0, a1))
    return out


def rounded_poly_pts(pts, r):
    flat = []
    for a, b, c, rr, a0, a1 in corners(pts, r):
        flat += arc_points(c, rr, a0, a1) if rr else [a]
    return flat


def rounded_poly_d(pts, r):
    cs = corners(pts, r)
    d = ['M{:.2f} {:.2f}'.format(cs[0][0][0], cs[0][0][1])]
    for a, b, c, rr, a0, a1 in cs:
        d.append('L{:.2f} {:.2f}'.format(a[0], a[1]))
        if rr:
            d.append('A{:.2f} {:.2f} 0 0 {} {:.2f} {:.2f}'.format(
                rr, rr, 1 if a1 > a0 else 0, b[0], b[1]))
    d.append('Z')
    return ' '.join(d)


def rrect_d(x, y, w, h, r):
    r = min(r, w / 2, h / 2)
    return ('M{:.2f} {:.2f} H{:.2f} A{} {} 0 0 1 {:.2f} {:.2f} V{:.2f} '
            'A{} {} 0 0 1 {:.2f} {:.2f} H{:.2f} A{} {} 0 0 1 {:.2f} {:.2f} '
            'V{:.2f} A{} {} 0 0 1 {:.2f} {:.2f} Z').format(
        x + r, y, x + w - r, r, r, x + w, y + r, y + h - r,
        r, r, x + w - r, y + h, x + r, r, r, x, y + h - r,
        y + r, r, r, x + r, y)


def arc_path(cx, cy, r):
    """Uma onda: arco de raio r varrendo ARC_A, com tampas redondas no traço."""
    p0 = (cx + r * math.cos(math.radians(ARC_A[0])), cy + r * math.sin(math.radians(ARC_A[0])))
    p1 = (cx + r * math.cos(math.radians(ARC_A[1])), cy + r * math.sin(math.radians(ARC_A[1])))
    return 'M{:.2f} {:.2f} A{:.2f} {:.2f} 0 0 1 {:.2f} {:.2f}'.format(
        p0[0], p0[1], r, r, p1[0], p1[1])


def arc_d(r):
    return arc_path(ARC_C[0], ARC_C[1], r)


# paths do mark em espaço de design — servem pro SVG e pro componente React
MARK_BODY_D = ' '.join([rrect_d(*BODY)] + [rrect_d(*w) for w in WHEELS])
MARK_WINDOW_D = rounded_poly_d(TAIL, TAIL_R) + ' ' + rrect_d(*BUBBLE)
MARK_ARC_D = [arc_d(r) for r in ARC_RR]

_pts = [p for r in ARC_RR for p in arc_points(ARC_C, r, *ARC_A)]
_hw = ARC_W / 2
MARK_BBOX = (
    min([BODY[0]] + [p[0] - _hw for p in _pts]),
    min([BODY[1]] + [p[1] - _hw for p in _pts]),
    max([BODY[0] + BODY[2]] + [p[0] + _hw for p in _pts]),
    max([WHEELS[0][1] + WHEELS[0][3]] + [p[1] + _hw for p in _pts]),
)
MARK_W = MARK_BBOX[2] - MARK_BBOX[0]
MARK_H = MARK_BBOX[3] - MARK_BBOX[1]


class T:
    """Transformação escala+translação. pt() leva do espaço de design ao alvo."""

    def __init__(self, s, tx, ty):
        self.s, self.tx, self.ty = s, tx, ty

    def pt(self, p):
        return (p[0] * self.s + self.tx, p[1] * self.s + self.ty)

    def n(self, v):
        return v * self.s

    def scaled(self, k):
        return T(self.s * k, self.tx * k, self.ty * k)

    def svg(self):
        return 'translate({:.3f} {:.3f}) scale({:.5f})'.format(self.tx, self.ty, self.s)


def fit(bbox, W, H, pad):
    """Encaixa bbox em WxH com folga 'pad' (fração do menor lado)."""
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    m = min(W, H) * pad
    s = min((W - 2 * m) / bw, (H - 2 * m) / bh)
    return T(s, (W - bw * s) / 2 - bbox[0] * s, (H - bh * s) / 2 - bbox[1] * s)


# ─────────── desenho raster ───────────
def stroke_arcs(d, cx, cy, radii, w, fill):
    hw = w / 2
    for R in radii:
        d.arc([cx - R - hw, cy - R - hw, cx + R + hw, cy + R + hw],
              ARC_A[0], ARC_A[1], fill=fill, width=max(1, int(round(w))))
        for a in ARC_A:  # tampas redondas — o arc() do Pillow corta reto
            p = (cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a)))
            d.ellipse([p[0] - hw, p[1] - hw, p[0] + hw, p[1] + hw], fill=fill)


def draw_arcs(d, t, fill):
    c = t.pt(ARC_C)
    stroke_arcs(d, c[0], c[1], [t.n(r) for r in ARC_RR], t.n(ARC_W), fill)


def draw_mark(d, t, body, window, arcs):
    """window=None não desenha a janela; window=TRANSPARENT vaza o fundo (mono)."""
    for (x, y, w, h, r) in [BODY] + WHEELS:
        x0, y0 = t.pt((x, y))
        x1, y1 = t.pt((x + w, y + h))
        d.rounded_rectangle([x0, y0, x1, y1], radius=t.n(r), fill=body)
    if window is not None:
        d.polygon([t.pt(p) for p in rounded_poly_pts(TAIL, TAIL_R)], fill=window)
        x, y, w, h, r = BUBBLE
        x0, y0 = t.pt((x, y))
        x1, y1 = t.pt((x + w, y + h))
        d.rounded_rectangle([x0, y0, x1, y1], radius=t.n(r), fill=window)
    draw_arcs(d, t, arcs)


def canvas(W, H, bg=TRANSPARENT):
    im = Image.new('RGBA', (W * SS, H * SS), bg)
    return im, ImageDraw.Draw(im)


def finish(im, W, H, path):
    im = im.resize((W, H), Image.LANCZOS)
    im.save(path)
    print('   {} {}x{}'.format(os.path.relpath(path, ROOT), W, H))
    return im


def render_icon(path, size, pad, bg, body, window, arcs):
    im, d = canvas(size, size, bg)
    draw_mark(d, fit(MARK_BBOX, size, size, pad).scaled(SS), body, window, arcs)
    return finish(im, size, size, path)


# ─────────── tipografia ───────────
class Type:
    """Nunito 900: métricas do fontTools (exatas) + rasterização pelo Pillow."""

    def __init__(self, path):
        f = TTFont(path)
        self.f = instantiateVariableFont(f, {'wght': 900}, inplace=True, updateFontNames=False)
        self.upem = self.f['head'].unitsPerEm
        self.cmap = self.f.getBestCmap()
        self.gs = self.f.getGlyphSet()
        self.hmtx = self.f['hmtx']
        cap = getattr(self.f['OS/2'], 'sCapHeight', 0) or int(0.705 * self.upem)
        self.cap = cap / self.upem
        self._pil = {}

    def pil(self, size):
        key = round(size, 2)
        if key not in self._pil:
            fo = ImageFont.truetype(FONT_PATH, key)
            fo.set_variation_by_axes([900])
            self._pil[key] = fo
        return self._pil[key]

    def adv(self, ch, size):
        return self.hmtx[self.cmap[ord(ch)]][0] * size / self.upem

    def layout(self, text, size, x, tracking):
        """[(char, x)] e x final, com tracking em fração do corpo."""
        out = []
        for ch in text:
            out.append((ch, x))
            x += self.adv(ch, size) + tracking * size
        return out, x - tracking * size

    def d(self, text, size, x, baseline, tracking):
        k = size / self.upem
        cmds = []
        for ch, cx in self.layout(text, size, x, tracking)[0]:
            if ch == ' ':
                continue
            pen = SVGPathPen(self.gs, ntos=lambda v: '{:.2f}'.format(v))
            self.gs[self.cmap[ord(ch)]].draw(TransformPen(pen, (k, 0, 0, -k, cx, baseline)))
            cmds.append(pen.getCommands())
        return ' '.join(cmds)

    def draw(self, d, text, size, x, baseline, tracking, fill):
        fo = self.pil(size)
        for ch, cx in self.layout(text, size, x, tracking)[0]:
            if ch != ' ':
                d.text((cx, baseline), ch, font=fo, fill=fill, anchor='ls')

    def width(self, text, size, tracking):
        return self.layout(text, size, 0, tracking)[1]


TYPE = Type(FONT_PATH)
TRACK = -0.028          # tracking do wordmark: apertado, como o resto da UI

# ─── o circunflexo do "ô" É a buzina ───
# Não é o arco do mark reduzido: naquela escala o traço viraria fio de cabelo
# do lado de um Nunito 900. Mesma varredura e mesma razão entre os raios (a
# assinatura do desenho), peso recalculado pro corpo — compensação óptica,
# igual ao que uma fonte faz com o próprio acento. Valores em fração do corpo.
ACC = dict(r1=0.082, r2=0.208, w=0.066, lift=0.600)


def accent(size, o_x, o_w, baseline):
    """Ondas que substituem o circunflexo, já em coordenadas do texto."""
    r1, r2, w = ACC['r1'] * size, ACC['r2'] * size, ACC['w'] * size
    return dict(cx=o_x + o_w / 2 - r2 / 2, cy=baseline - ACC['lift'] * size,
                radii=[r1, r2], w=w, top=baseline - ACC['lift'] * size - r2 - w / 2)


def lockup(size=100, stacked=False, pad=0.0):
    """Layout do lockup: mark + 'Alo' + 'Buzinou' + circunflexo-onda.

    O mark é o MESMO do ícone (sólido) — era exatamente aí que o par vinha
    divergindo: ícone cheio, wordmark contornado.
    """
    cap = TYPE.cap * size
    words = [('Alo', EMERALD), ('Buzinou', GREEN)]
    space = TYPE.adv(' ', size) + TRACK * size
    text_w = TYPE.width('Alo', size, TRACK) + space + TYPE.width('Buzinou', size, TRACK)

    if stacked:
        mark_h = 2.35 * cap
        gap = 0.46 * cap
        s = mark_h / MARK_H
        tmark = T(s, text_w / 2 - MARK_W * s / 2 - MARK_BBOX[0] * s, -MARK_BBOX[1] * s)
        baseline = mark_h + gap + cap
        W, H = text_w, baseline
        x0 = 0.0
    else:
        mark_h = 1.86 * cap
        gap = 0.34 * cap
        s = mark_h / MARK_H
        tmark = T(s, -MARK_BBOX[0] * s, -MARK_BBOX[1] * s)
        x0 = MARK_W * s + gap
        baseline = mark_h / 2 + cap / 2
        W, H = x0 + text_w, mark_h

    runs, x = [], x0
    for text, color in words:
        runs.append((text, x, color))
        x = TYPE.layout(text, size, x, TRACK)[1] + space
    o_x = TYPE.layout('Alo', size, runs[0][1], TRACK)[0][2][1]
    acc = accent(size, o_x, TYPE.adv('o', size), baseline)

    top = min(0.0, acc['top'])
    m = pad * H
    vb = (-m, top - m, W + 2 * m, H - top + 2 * m)
    return dict(vb=vb, mark=tmark, accent=acc, runs=runs, baseline=baseline, size=size, W=W, H=H)


# ─────────── SVG ───────────
def _arc_svg(color):
    return ''.join(
        '<path d="{}" stroke="{}" stroke-width="{}" stroke-linecap="round"/>'.format(d, color, ARC_W)
        for d in MARK_ARC_D)


def accent_svg(acc, color):
    return ''.join(
        '<path d="{}" stroke="{}" stroke-width="{:.2f}" stroke-linecap="round"/>'.format(
            arc_path(acc['cx'], acc['cy'], r), color, acc['w'])
        for r in acc['radii'])


def mark_svg(size=512, pad=0.06, mono=None, dark_aware=False):
    t = fit(MARK_BBOX, size, size, pad)
    if mono:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" fill="none">\n'
            '  <mask id="ab-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="{s}" height="{s}">\n'
            '    <g transform="{t}">\n'
            '      <path d="{body}" fill="#fff"/>\n'
            '      {arcs}\n'
            '      <path d="{win}" fill="#000"/>\n'
            '    </g>\n'
            '  </mask>\n'
            '  <rect width="{s}" height="{s}" fill="{mono}" mask="url(#ab-cut)"/>\n'
            '</svg>\n'
        ).format(s=size, t=t.svg(), body=MARK_BODY_D, win=MARK_WINDOW_D,
                 arcs=_arc_svg('#fff'), mono=mono)

    style, body, window, arcs = '', EMERALD, WHITE, GREEN
    if dark_aware:
        # Favicon em aba escura: a carroceria vira branca e a janela vira o
        # quase-preto do app, senão o verde escuro afunda no chrome escuro.
        style = ('<style>:root{{--b:{};--w:{};--a:{}}}'
                 '@media (prefers-color-scheme:dark){{:root{{--b:{};--w:{};--a:{}}}}}</style>'
                 ).format(EMERALD, WHITE, GREEN, WHITE, NEAR_BLACK, GREEN)
        body, window, arcs = 'var(--b)', 'var(--w)', 'var(--a)'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" fill="none">\n'
        '  {style}\n'
        '  <g transform="{t}">\n'
        '    <path d="{body}" fill="{cb}"/>\n'
        '    <path d="{win}" fill="{cw}"/>\n'
        '    {arcs}\n'
        '  </g>\n'
        '</svg>\n'
    ).format(s=size, style=style, t=t.svg(), body=MARK_BODY_D, win=MARK_WINDOW_D,
             cb=body, cw=window, arcs=_arc_svg(arcs))


def wordmark_svg(stacked=False, white=False):
    L = lockup(100, stacked=stacked, pad=0.02)
    vb = L['vb']
    body = WHITE if white else EMERALD
    window = NEAR_BLACK if white else WHITE
    c1 = WHITE if white else EMERALD
    parts = ['<g transform="{}">'.format(L['mark'].svg()),
             '<path d="{}" fill="{}"/>'.format(MARK_BODY_D, body),
             '<path d="{}" fill="{}"/>'.format(MARK_WINDOW_D, window),
             _arc_svg(GREEN),
             '</g>']
    for text, x, color in L['runs']:
        parts.append('<path d="{}" fill="{}"/>'.format(
            TYPE.d(text, L['size'], x, L['baseline'], TRACK),
            c1 if color == EMERALD else GREEN))
    parts.append(accent_svg(L['accent'], GREEN))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="{:.2f} {:.2f} {:.2f} {:.2f}" '
            'fill="none">\n  '.format(*vb) + '\n  '.join(parts) + '\n</svg>\n')


def draw_lockup(d, L, k, off, body, window, arcs, c1, c2):
    """Rasteriza um lockup: k = escala do canvas, off = deslocamento (x, y)."""
    def T2(t):
        return T(t.s * k, t.tx * k + off[0], t.ty * k + off[1])

    draw_mark(d, T2(L['mark']), body, window, arcs)
    for text, x, color in L['runs']:
        TYPE.draw(d, text, L['size'] * k, x * k + off[0], L['baseline'] * k + off[1],
                  TRACK, c1 if color == EMERALD else c2)
    acc = L['accent']
    stroke_arcs(d, acc['cx'] * k + off[0], acc['cy'] * k + off[1],
                [r * k for r in acc['radii']], acc['w'] * k, c2)


def wordmark_png(path, height=260, white=False):
    L = lockup(100, pad=0.03)
    k = height / L['vb'][3]
    W = int(round(L['vb'][2] * k))
    H = int(round(L['vb'][3] * k))
    im, d = canvas(W, H)
    draw_lockup(d, L, k * SS, (-L['vb'][0] * k * SS, -L['vb'][1] * k * SS),
                rgba(WHITE if white else EMERALD),
                TRANSPARENT if white else rgba(WHITE),
                rgba(GREEN),
                rgba(WHITE if white else EMERALD), rgba(GREEN))
    finish(im, W, H, path)


def radial(W, H, cx, cy, r, color, alpha, small=220):
    """Camada de brilho radial. Calcula o gradiente numa grade pequena e amplia:
    mais barato e mais suave que empilhar elipses (que, em RGBA, se substituem
    em vez de somar — foi assim que o primeiro brilho saiu invisível)."""
    sw = small
    sh = max(1, int(small * H / W))
    m = Image.new('L', (sw, sh))
    px = m.load()
    for y in range(sh):
        for x in range(sw):
            dx = (x + 0.5) * W / sw - cx
            dy = (y + 0.5) * H / sh - cy
            t = 1.0 - min(1.0, math.hypot(dx, dy) / r)
            px[x, y] = int(255 * t * t)
    layer = Image.new('RGBA', (W, H), rgba(color, 255))
    layer.putalpha(m.resize((W, H), Image.BICUBIC).point(lambda v: int(v * alpha / 255)))
    return layer


def og_image(path, W=1200, H=630):
    """Card de compartilhamento — o convite do motorista roda no WhatsApp."""
    im = Image.new('RGBA', (W, H), rgba(NEAR_BLACK))
    im.alpha_composite(radial(W, H, 170, -90, 900, EMERALD, 190))    # como o hero da Home
    im.alpha_composite(radial(W, H, W - 90, 40, 620, GREEN, 70))

    grid = Image.new('RGBA', (W, H), TRANSPARENT)   # malha sutil, a mesma da Home
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 44):
        gd.line([(x, 0), (x, H)], fill=rgba(WHITE, 16))
    for y in range(0, H, 44):
        gd.line([(0, y), (W, y)], fill=rgba(WHITE, 16))
    im.alpha_composite(grid)

    over, od = canvas(W, H)
    L = lockup(100, stacked=True, pad=0.0)
    k = 300 / L['vb'][3]
    off = ((W - L['vb'][2] * k) / 2 - L['vb'][0] * k, 96 - L['vb'][1] * k)
    draw_lockup(od, L, k * SS, (off[0] * SS, off[1] * SS),
                rgba(WHITE), TRANSPARENT, rgba(GREEN), rgba(WHITE), rgba(GREEN))
    for text, size, y, color in (('Onde a perua está, agora.', 46, 500, rgba(WHITE, 235)),
                                 ('Rota, avisos e mensalidade num lugar só.', 30, 556, rgba(WHITE, 150))):
        w = TYPE.width(text, size, -0.01)
        TYPE.draw(od, text, size * SS, (W - w) / 2 * SS, y * SS, -0.01, color)
    im.alpha_composite(over.resize((W, H), Image.LANCZOS))
    im.convert('RGB').save(path, quality=95)
    print('   {} {}x{}'.format(os.path.relpath(path, ROOT), W, H))


def js_paths():
    """Geometria pro componente React — logo vetorial, sem webfont e sem PNG.

    As letras saem UMA vez, na origem (x=0, linha de base=0); cada layout
    entra só com o transform. Guardar o texto duas vezes dobrava o peso do
    bundle pelo mesmo desenho.
    """
    size = 100
    space = TYPE.adv(' ', size) + TRACK * size
    buz_x = TYPE.width('Alo', size, TRACK) + space
    acc0 = accent(size, TYPE.layout('Alo', size, 0, TRACK)[0][2][1], TYPE.adv('o', size), 0)
    lines = [
        '// GERADO por scripts/brand/build_brand.py — não edite à mão.',
        '// Geometria do logo do Alô Buzinou em path, pra o <Logo /> renderizar',
        '// vetor sem depender de webfont nem de PNG.',
        '',
        'export const MARK = {',
        "  viewBox: '{:.2f} {:.2f} {:.2f} {:.2f}',".format(MARK_BBOX[0], MARK_BBOX[1], MARK_W, MARK_H),
        "  body: '{}',".format(MARK_BODY_D),
        "  window: '{}',".format(MARK_WINDOW_D),
        '  arcs: [' + ', '.join("'{}'".format(d) for d in MARK_ARC_D) + '],',
        '  arcWidth: {},'.format(ARC_W),
        '};',
        '',
        '// "Alo" + "Buzinou" em corpo 100, na origem. O circunflexo do "ô" é a',
        '// buzina: mesmas ondas do mark, com peso recalculado pro corpo do texto.',
        'export const TEXT = {',
        "  alo: '{}',".format(TYPE.d('Alo', size, 0, 0, TRACK)),
        "  buzinou: '{}',".format(TYPE.d('Buzinou', size, buz_x, 0, TRACK)),
        '  accent: [' + ', '.join("'{}'".format(arc_path(acc0['cx'], acc0['cy'], r))
                                  for r in acc0['radii']) + '],',
        '  accentWidth: {:.2f},'.format(acc0['w']),
        '};',
        '',
    ]
    for name, stacked in (('LOCKUP', False), ('STACKED', True)):
        L = lockup(size, stacked=stacked, pad=0.03)
        lines += [
            'export const {} = {{'.format(name),
            "  viewBox: '{:.2f} {:.2f} {:.2f} {:.2f}',".format(*L['vb']),
            "  markTransform: '{}',".format(L['mark'].svg()),
            "  textTransform: 'translate({:.3f} {:.3f})',".format(L['runs'][0][1], L['baseline']),
            '};',
            '',
        ]
    with open(JSOUT, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    print('   {}'.format(os.path.relpath(JSOUT, ROOT)))


def main():
    print('SVG')
    for name, kw in (('mark.svg', dict()),
                     ('mark-white.svg', dict(mono=WHITE)),
                     ('favicon.svg', dict(pad=0.02, dark_aware=True))):
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
            fh.write(mark_svg(**kw))
        print('   public/brand/' + name)
    for name, kw in (('wordmark.svg', dict()),
                     ('wordmark-white.svg', dict(white=True)),
                     ('wordmark-stacked.svg', dict(stacked=True))):
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
            fh.write(wordmark_svg(**kw))
        print('   public/brand/' + name)

    print('PNG')
    C = (rgba(EMERALD), rgba(WHITE), rgba(GREEN))    # mark colorido
    # Ícones do PWA: fundo branco cheio — o launcher aplica a máscara dele.
    render_icon(os.path.join(OUT, 'icon-192.png'), 192, 0.10, rgba(WHITE), *C)
    render_icon(os.path.join(OUT, 'icon-512.png'), 512, 0.10, rgba(WHITE), *C)
    # Maskable: conteúdo dentro da zona segura (60% central).
    render_icon(os.path.join(OUT, 'icon-maskable-512.png'), 512, 0.21, rgba(WHITE), *C)
    render_icon(os.path.join(OUT, 'apple-touch-icon.png'), 180, 0.11, rgba(WHITE), *C)
    # Badge de notificação: o Android usa só o alfa, então é silhueta branca
    # com a janela VAZADA (senão o balão desaparece dentro da carroceria).
    render_icon(os.path.join(OUT, 'notification-badge-96.png'), 96, 0.06,
                TRANSPARENT, rgba(WHITE), TRANSPARENT, rgba(WHITE))
    render_icon(os.path.join(OUT, 'mark-512.png'), 512, 0.04, TRANSPARENT, *C)
    render_icon(os.path.join(OUT, 'mark-white-512.png'), 512, 0.04,
                TRANSPARENT, rgba(WHITE), TRANSPARENT, rgba(WHITE))
    wordmark_png(os.path.join(OUT, 'wordmark.png'))
    wordmark_png(os.path.join(OUT, 'wordmark-white.png'), white=True)
    og_image(os.path.join(OUT, 'og-image.png'))

    # Favicon .ico: em 16px o desenho vazado some, então vai tile esmeralda
    # com o mark branco — legível em aba clara E escura.
    master = os.path.join(OUT, '_ico-master.png')
    # A janela vai na COR DO FUNDO, não vazada: com alfa 0 sobre carroceria
    # branca o balão simplesmente desaparecia. E as ondas em branco, porque
    # em 16 px o verde sobre esmeralda não separa.
    ico = render_icon(master, 256, 0.14, rgba(EMERALD), rgba(WHITE), rgba(EMERALD), rgba(WHITE))
    ico.save(os.path.join(OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    os.remove(master)
    print('   public/brand/favicon.ico 16/32/48')

    print('JS')
    js_paths()


if __name__ == '__main__':
    main()
