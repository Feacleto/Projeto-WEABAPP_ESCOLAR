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

import io
import math
import os
import struct

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
# O MESMO verde, um degrau abaixo, pra fundo CLARO. Não é cor nova: é o
# `accentDark` que já está no tailwind.config.js.
#
# As ondas e a palavra "Buzinou" carregam o sentido inteiro da marca — o "e
# te avisou" — e eram a coisa menos visível dela: #52C41A dá 2,27:1 sobre
# branco e 1,99:1 sobre o #EEF1EF do app, quando a WCAG 1.4.11 pede 3:1 pra
# gráfico com significado. A carroceria, que é só carroceria, tem 7,59:1.
# Com #3F9B12 sobe pra 3,55:1 / 3,12:1.
#
# Em fundo ESCURO nada disso vale: ali o #52C41A dá 8,36:1 e continua sendo
# a escolha certa. Por isso são duas constantes e não uma troca global.
GREEN_ON_LIGHT = '#3F9B12'
NEAR_BLACK = '#0B1210'
WHITE = '#FFFFFF'


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgba(h, a=255):
    return rgb(h) + (a,)


TRANSPARENT = (0, 0, 0, 0)

# ─────────── o invariante das ondas ───────────
# A assinatura que o ícone e o circunflexo do "ô" compartilham NÃO é a razão
# entre os raios — essa ninguém enxerga. É o VÃO SOBRE O TRAÇO: quando o vão
# entre dois arcos passa da espessura deles, o olho para de ler "um gesto" e
# passa a ler "dois objetos soltos".
#
# O comentário antigo do ACC prometia "mesma razão entre os raios". Era falso:
# o ícone estava em 126/70 = 1,80 e o acento em 0,208/0,082 = 2,54. Pior, no
# que importa os dois estavam a um fator de 2 de distância — vão/traço de
# 1,80 no ícone contra 0,91 no acento. O acento é que estava certo.
#
# Agora existe um número só, e os dois raios externos DERIVAM dele. Não dá
# mais pra um andar sem o outro, que é a razão de este gerador existir.
VAO_SOBRE_TRACO = 0.91


def raio_externo(r_interno, traco):
    """Raio externo que põe o vão entre os dois arcos em VAO_SOBRE_TRACO."""
    return r_interno + traco * (1 + VAO_SOBRE_TRACO)


# ─────────── geometria, em espaço de design ───────────
# Frente da perua = retângulo arredondado; janela = balão de fala; as ondas da
# buzina saem do canto superior direito, POR FORA da carroceria (o raio do
# canto abre a folga na diagonal).
#
# Os raios do corpo e da janela são CONCÊNTRICOS-ISH de propósito. Entre os
# dois há 52 un. em cima, embaixo e nos lados; na diagonal do canto a conta é
# outra, e com 58 por fora contra 44 por dentro dava 67,7 — a moldura verde
# ficava 30% mais gorda nos quatro cantos. Concêntrico de verdade exigiria
# janela com raio 6 (interno = externo − vão), o que mataria o balão; 68/32
# é o meio-termo que derruba a distorção pra 13%.
BODY = (0, 74, 360, 298, 68)                       # x, y, w, h, raio
WHEELS = [(32, 356, 52, 56, 18), (276, 356, 52, 56, 18)]
BUBBLE = (52, 126, 256, 170, 32)
TAIL = [(200, 268), (268, 268), (256, 348)]        # rabicho do balão
# Um raio POR CANTO, não um escalar. O bico é um ângulo de 43,5°, e um raio
# de 12 num ângulo desses consome 30 un. de cada aresta: o desenho pedia a
# ponta em y=348 e o gerador entregava y=328,5 — um quarto do bico comido
# antes de sair daqui. O bico é o que separa balão de fala de para-brisa.
TAIL_R = (12, 12, 6)                               # dois ombros macios, ponta afiada
ARC_C = (314, 126)                                 # centro virtual das ondas
ARC_W = 24                                         # espessura do traço
ARC_R_IN = 74                                      # raio interno
ARC_RR = (ARC_R_IN, raio_externo(ARC_R_IN, ARC_W))
ARC_A = (282, 344)                                 # varredura (0 grau = leste, y p/ baixo)


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
    """Cantos arredondados de um polígono: (entrada, saída, centro, raio, ang0, ang1).

    `r` pode ser um número (mesmo raio em todo canto) ou uma sequência com um
    raio por ponto. O bico do balão precisa da segunda forma: num ângulo agudo
    o arredondamento consome muito mais aresta do que num canto reto, e um
    raio único deixava a ponta cega.
    """
    out = []
    n = len(pts)
    radii = [r] * n if isinstance(r, (int, float)) else list(r)
    for i in range(n):
        prev, p, nxt = pts[(i - 1) % n], pts[i], pts[(i + 1) % n]
        v1, v2 = _norm(_sub(prev, p)), _norm(_sub(nxt, p))
        ang = math.acos(max(-1.0, min(1.0, v1[0] * v2[0] + v1[1] * v2[1])))
        if ang < 1e-6 or abs(ang - math.pi) < 1e-6:
            out.append((p, p, p, 0, 0, 0))
            continue
        tan = min(radii[i] / math.tan(ang / 2), _len(_sub(prev, p)) / 2, _len(_sub(nxt, p)) / 2)
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


def arc_path(cx, cy, r, a=None):
    """Uma onda: arco de raio r varrendo `a`, com tampas redondas no traço."""
    a = a or ARC_A
    p0 = (cx + r * math.cos(math.radians(a[0])), cy + r * math.sin(math.radians(a[0])))
    p1 = (cx + r * math.cos(math.radians(a[1])), cy + r * math.sin(math.radians(a[1])))
    return 'M{:.2f} {:.2f} A{:.2f} {:.2f} 0 0 1 {:.2f} {:.2f}'.format(
        p0[0], p0[1], r, r, p1[0], p1[1])


def arc_d(r):
    return arc_path(ARC_C[0], ARC_C[1], r)


# ─────────── degraus de tamanho ───────────
# Uma geometria, três reduções. Reduzir o desenho inteiro pra 16 px punha o
# traço da onda em 0,6 px e a roda em 1,6 px: abaixo de um pixel não existe
# desenho, existe cinza. Cada degrau joga fora o que não sobrevive naquele
# tamanho, em vez de entregar a mesma arte encolhida.
#
# A ordem de descarte é a ordem em que os elementos MORREM, e ela sai da
# espessura de cada um: a onda é um traço de 24, a roda é um bloco de 52×56,
# o balão tem 256×170. Some a onda primeiro, a roda nunca — foi o que a
# primeira tentativa errou (cortava a roda e segurava a onda, que a 32 px
# virava um risco branco de 5 px no canto, lido como reflexo e não como som).
#
#   A  ≥ 64 px   completo — corpo, rodas, balão, as duas ondas
#   B  24–64 px  sem ondas: fica a silhueta, que é o que se reconhece
#   C  ≤ 24 px   ladrilho: só o balão, que é o que carrega o sentido
#
# O degrau B é a MESMA caixa do lockup (LOCK_BBOX) — mark sem ondas —, então
# a perua ocupa a largura inteira do quadro em vez de ceder 13% pro vazio
# onde as ondas estariam.
TIER_B = dict(radii=())
TIER_C_RX = 0.219                                  # 112/512, raio do ladrilho
TIER_C_PAD = 0.19                                  # folga do balão dentro dele


def mark_bbox(wheels=True, radii=ARC_RR, arc_w=ARC_W):
    pts = [p for r in radii for p in arc_points(ARC_C, r, *ARC_A)]
    hw = arc_w / 2
    bottom = (WHEELS[0][1] + WHEELS[0][3]) if wheels else (BODY[1] + BODY[3])
    return (
        min([BODY[0]] + [p[0] - hw for p in pts]),
        min([BODY[1]] + [p[1] - hw for p in pts]),
        max([BODY[0] + BODY[2]] + [p[0] + hw for p in pts]),
        max([bottom] + [p[1] + hw for p in pts]),
    )


# paths do mark em espaço de design — servem pro SVG e pro componente React
MARK_BODY_D = ' '.join([rrect_d(*BODY)] + [rrect_d(*w) for w in WHEELS])
MARK_WINDOW_D = rounded_poly_d(TAIL, TAIL_R) + ' ' + rrect_d(*BUBBLE)
MARK_ARC_D = [arc_d(r) for r in ARC_RR]

MARK_BBOX = mark_bbox()
MARK_W = MARK_BBOX[2] - MARK_BBOX[0]
MARK_H = MARK_BBOX[3] - MARK_BBOX[1]

# Caixa do mark SEM as ondas — é a que o lockup usa. Medir pela caixa com
# ondas e depois não desenhá-las reservaria 25 un. de vazio entre a perua e
# a palavra, e encolheria a perua pelo mesmo tanto.
LOCK_BBOX = mark_bbox(radii=())
LOCK_W = LOCK_BBOX[2] - LOCK_BBOX[0]
LOCK_H = LOCK_BBOX[3] - LOCK_BBOX[1]

# Caixa só do balão (bolha + bico) — é o que o degrau C mostra.
_wp = rounded_poly_pts(TAIL, TAIL_R)
WINDOW_BBOX = (
    min([BUBBLE[0]] + [p[0] for p in _wp]),
    min([BUBBLE[1]] + [p[1] for p in _wp]),
    max([BUBBLE[0] + BUBBLE[2]] + [p[0] for p in _wp]),
    max([BUBBLE[1] + BUBBLE[3]] + [p[1] for p in _wp]),
)


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
def stroke_arcs(d, cx, cy, radii, w, fill, sweep=None):
    sweep = sweep or ARC_A
    hw = w / 2
    for R in radii:
        d.arc([cx - R - hw, cy - R - hw, cx + R + hw, cy + R + hw],
              sweep[0], sweep[1], fill=fill, width=max(1, int(round(w))))
        for a in sweep:  # tampas redondas — o arc() do Pillow corta reto
            p = (cx + R * math.cos(math.radians(a)), cy + R * math.sin(math.radians(a)))
            d.ellipse([p[0] - hw, p[1] - hw, p[0] + hw, p[1] + hw], fill=fill)


def draw_arcs(d, t, fill, radii=ARC_RR, arc_w=ARC_W):
    c = t.pt(ARC_C)
    stroke_arcs(d, c[0], c[1], [t.n(r) for r in radii], t.n(arc_w), fill)


def draw_mark(d, t, body, window, arcs, wheels=True, radii=ARC_RR, arc_w=ARC_W):
    """window=None não desenha a janela; window=TRANSPARENT vaza o fundo (mono).

    arcs=None não desenha as ondas. Dois usos: os degraus menores, onde o
    traço não caberia em pixel nenhum, e o LOCKUP — no logotipo com a palavra
    quem buzina é o circunflexo do "ô", e a buzina aparece uma vez por peça.
    """
    for (x, y, w, h, r) in [BODY] + (WHEELS if wheels else []):
        x0, y0 = t.pt((x, y))
        x1, y1 = t.pt((x + w, y + h))
        d.rounded_rectangle([x0, y0, x1, y1], radius=t.n(r), fill=body)
    if window is not None:
        d.polygon([t.pt(p) for p in rounded_poly_pts(TAIL, TAIL_R)], fill=window)
        x, y, w, h, r = BUBBLE
        x0, y0 = t.pt((x, y))
        x1, y1 = t.pt((x + w, y + h))
        d.rounded_rectangle([x0, y0, x1, y1], radius=t.n(r), fill=window)
    if arcs is not None:
        draw_arcs(d, t, arcs, radii, arc_w)


def canvas(W, H, bg=TRANSPARENT):
    im = Image.new('RGBA', (W * SS, H * SS), bg)
    return im, ImageDraw.Draw(im)


def finish(im, W, H, path):
    im = im.resize((W, H), Image.LANCZOS)
    im.save(path)
    print('   {} {}x{}'.format(os.path.relpath(path, ROOT), W, H))
    return im


def icon_image(size, pad, bg, body, window, arcs, tier='A'):
    kw = TIER_B if tier == 'B' else {}
    im, d = canvas(size, size, bg)
    draw_mark(d, fit(mark_bbox(**kw), size, size, pad).scaled(SS),
              body, window, arcs, **kw)
    return im.resize((size, size), Image.LANCZOS)


def tile_image(size, bg, fg):
    """Degrau C rasterizado: ladrilho cheio com o balão dentro."""
    im, d = canvas(size, size)
    S = size * SS
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=TIER_C_RX * S, fill=bg)
    t = fit(WINDOW_BBOX, size, size, TIER_C_PAD).scaled(SS)
    d.polygon([t.pt(p) for p in rounded_poly_pts(TAIL, TAIL_R)], fill=fg)
    x, y, w, h, r = BUBBLE
    d.rounded_rectangle([t.pt((x, y)), t.pt((x + w, y + h))], radius=t.n(r), fill=fg)
    return im.resize((size, size), Image.LANCZOS)


def render_icon(path, size, pad, bg, body, window, arcs, tier='A'):
    im = icon_image(size, pad, bg, body, window, arcs, tier)
    im.save(path)
    print('   {} {}x{}'.format(os.path.relpath(path, ROOT), size, size))
    return im


def write_ico(path, images):
    """.ico com uma arte POR TAMANHO, cada uma no seu degrau.

    O Pillow só sabe redimensionar UMA imagem pros vários tamanhos do .ico —
    e era exatamente isso que punha a roda de 1,6 px e o traço de 0,6 px no
    quadro de 16. Aqui cada entrada é um PNG próprio: 16 e 24 recebem o
    ladrilho com o balão, 32 e 48 recebem a perua sem rodas com uma onda.

    PNG dentro de .ico é aceito desde o Vista, e todo navegador que ainda
    pede .ico entende. O container em si é meia dúzia de campos.
    """
    blobs = []
    for im in images:
        buf = io.BytesIO()
        im.save(buf, format='PNG')
        blobs.append(buf.getvalue())
    off = 6 + 16 * len(blobs)
    out = struct.pack('<HHH', 0, 1, len(blobs))
    for im, blob in zip(images, blobs):
        out += struct.pack('<BBBBHHII',
                           0 if im.width >= 256 else im.width,
                           0 if im.height >= 256 else im.height,
                           0, 0, 1, 32, len(blob), off)
        off += len(blob)
    with open(path, 'wb') as fh:
        fh.write(out + b''.join(blobs))
    print('   {} {}'.format(os.path.relpath(path, ROOT),
                            '/'.join(str(i.width) for i in images)))


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
        """[(char, x)] e x final, com tracking e kerning em fração do corpo."""
        out = []
        for i, ch in enumerate(text):
            out.append((ch, x))
            x += self.adv(ch, size) + tracking * size
            if i + 1 < len(text):
                x += KERN.get(text[i:i + 2], 0.0) * size
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

# ─── kerning: quatro pares fora da faixa ───
# TRACK sozinho é uniforme, e tracking uniforme preserva as laterais que a
# fonte trouxe — feitas pra texto corrido, não pra um logotipo em peso 900.
# Medido na própria Nunito, o vão de tinta ia de 0,0023 a 0,0653 em: 28 vezes
# de diferença entre o par mais apertado e o mais aberto.
#
# E o pior caía no pior lugar: o "l" e o "o" de "Alo" se TOCAVAM (0,0023 em,
# dois décimos de pixel a 100 de corpo) — e é esse "o" que recebe o
# circunflexo-buzina. A letra mais importante da marca era a espremida.
#
# Só os quatro fora da faixa entram aqui. "Al", "uz", "no" e "ou" já estavam
# entre 0,039 e 0,057 e não se toca neles. Valores em fração do corpo.
KERN = {'lo': +0.038, 'zi': +0.013, 'in': -0.015, 'Bu': -0.012}

# ─── o circunflexo do "ô" É a buzina ───
# Não é o arco do mark reduzido: naquela escala o traço viraria fio de cabelo
# do lado de um Nunito 900. O peso é recalculado pro corpo do texto —
# compensação óptica, igual ao que uma fonte faz com o próprio acento.
#
# O que ele COMPARTILHA com o ícone é a varredura (ARC_A) e o VAO_SOBRE_TRACO,
# de onde o raio externo deriva. O comentário antigo prometia "mesma razão
# entre os raios" e isso era falso — 2,54 aqui contra 1,80 lá. Agora não é
# promessa: r2 não existe como número digitado, sai da conta.
ACC = dict(r1=0.105, w=0.066, lift=0.577)
ACC['r2'] = raio_externo(ACC['r1'], ACC['w'])

# A VARREDURA é própria, e isso não é inconsistência — é o que a âncora pede.
# As ondas do ícone saem de um CANTO, então varrem do topo pra direita e a
# assimetria é o próprio sentido ("está saindo dali"). O acento se apoia numa
# LETRA, e acento assimétrico não lê como acento: com a varredura do ícone
# ele virava um tique solto em cima e à direita do "o", não um circunflexo.
#
# Aqui a varredura é simétrica em torno do topo (270°), o que centra a tinta
# sobre a letra. O que os dois compartilham é o VAO_SOBRE_TRACO, que é o que
# faz duas linhas lerem como um gesto — e essa parte o código garante.
ACC_A = (215, 325)

# Meio da corda, pra centrar o acento sobre o "o" seja qual for a varredura.
_ACC_MID = (math.cos(math.radians(ACC_A[0])) + math.cos(math.radians(ACC_A[1]))) / 2


def accent(size, o_x, o_w, baseline):
    """Ondas que substituem o circunflexo, já em coordenadas do texto."""
    r1, r2, w = ACC['r1'] * size, ACC['r2'] * size, ACC['w'] * size
    return dict(cx=o_x + o_w / 2 - _ACC_MID * r2, cy=baseline - ACC['lift'] * size,
                radii=[r1, r2], w=w, a=ACC_A,
                top=baseline - ACC['lift'] * size - r2 - w / 2)


def lockup(size=100, stacked=False, pad=0.0):
    """Layout do lockup: mark + 'Alo' + 'Buzinou' + circunflexo-onda.

    O mark é o MESMO do ícone (sólido) — era exatamente aí que o par vinha
    divergindo: ícone cheio, wordmark contornado.

    UMA BUZINA POR PEÇA
    Aqui o mark entra SEM ondas. Elas apareciam duas vezes na mesma peça — no
    ícone e no acento do "ô" — e os dois picos caíam a 0,24 da altura das
    maiúsculas um do outro: perto demais pra lerem como coisas diferentes,
    longe demais pra lerem como alinhados. Alinhar de verdade custaria
    encolher o ícone em 25% ou pendurar a perua meia maiúscula abaixo da
    linha de base, então a resposta não é alinhar, é não repetir.
    Quem buzina no logotipo é o acento, que é a parte espirituosa e está
    dentro do nome. No ícone SOZINHO as ondas ficam — ali não há palavra
    pra carregá-las.
    """
    cap = TYPE.cap * size
    words = [('Alo', EMERALD), ('Buzinou', GREEN)]
    space = TYPE.adv(' ', size) + TRACK * size
    text_w = TYPE.width('Alo', size, TRACK) + space + TYPE.width('Buzinou', size, TRACK)

    if stacked:
        mark_h = 2.35 * cap
        gap = 0.46 * cap
        s = mark_h / LOCK_H
        tmark = T(s, text_w / 2 - LOCK_W * s / 2 - LOCK_BBOX[0] * s, -LOCK_BBOX[1] * s)
        baseline = mark_h + gap + cap
        W, H = text_w, baseline
        x0 = 0.0
    else:
        mark_h = 1.86 * cap
        gap = 0.34 * cap
        s = mark_h / LOCK_H
        tmark = T(s, -LOCK_BBOX[0] * s, -LOCK_BBOX[1] * s)
        x0 = LOCK_W * s + gap
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
def _arc_svg(color, w=None):
    return ''.join(
        '<path d="{}" stroke="{}" stroke-width="{}" stroke-linecap="round"/>'.format(
            d, color, ARC_W if w is None else w)
        for d in MARK_ARC_D)


def accent_svg(acc, color):
    return ''.join(
        '<path d="{}" stroke="{}" stroke-width="{:.2f}" stroke-linecap="round"/>'.format(
            arc_path(acc['cx'], acc['cy'], r, acc['a']), color, acc['w'])
        for r in acc['radii'])


def mark_svg(size=512, pad=0.06, mono=None, dark_aware=False, tile=False):
    """
    `tile=True` é a projeção de FAVICON, e ela existe por um motivo medido.

    O desenho normal é vazado: carroceria esmeralda, janela branca recortada,
    ondas de buzina em traço fino. Em 16 px isso não sobrevive — a onda tem
    espessura 20 num viewBox de 512, o que dá 0,63 px de traço, e some. O
    projeto já sabia disso: o `.ico` virou tile esmeralda anos atrás, e o
    comentário no index.html diz a razão com todas as letras.

    A conclusão certa tinha sido tirada e aplicada só no formato de RESERVA.
    O `.svg`, que é o que o Chrome de fato usa, continuou vazado — então o
    conserto valia pro navegador antigo e não pro atual.

    A projeção inverte o desenho: quadrado esmeralda cheio, marca branca,
    janela na cor do fundo (com alfa zero sobre carroceria branca o balão
    simplesmente desaparece) e ondas brancas e mais grossas, porque em 16 px
    o verde sobre esmeralda não separa. É a mesma decisão do `.ico`, e sai da
    mesma geometria — que é a razão de este gerador existir.

    Sem media query aqui, ao contrário do vazado: um quadrado de cor sólida
    tem contraste contra aba clara E escura, então não há nada pra adaptar.
    """
    if tile:
        # DEGRAU C. O favicon é visto a 16–20 px numa aba, e ali a perua
        # inteira não cabe: mesmo em ladrilho, a roda dava 1,3 px e a onda
        # 1,0 px — dois borrões que só engordavam a silhueta. Fica o BALÃO,
        # que é o elemento maior e o que carrega o sentido, em cheio dentro
        # do ladrilho. Continua sendo esta marca, sem o que não sobrevive.
        t = fit(WINDOW_BBOX, size, size, TIER_C_PAD)
        L = [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" fill="none">',
          '  <rect width="{s}" height="{s}" rx="{r}" fill="{bg}"/>',
          '  <g transform="{t}"><path d="{win}" fill="{fg}"/></g>',
          '</svg>',
          '',
        ]
        return chr(10).join(L).format(
            s=size, r=round(size * TIER_C_RX), bg=EMERALD, fg=WHITE,
            t=t.svg(), win=MARK_WINDOW_D)
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

    style, body, window, arcs = '', EMERALD, WHITE, GREEN_ON_LIGHT
    if dark_aware:
        # Favicon em aba escura: a carroceria vira branca e a janela vira o
        # quase-preto do app, senão o verde escuro afunda no chrome escuro.
        # E o verde volta ao claro: sobre #0B1210 o #52C41A dá 8,36:1.
        style = ('<style>:root{{--b:{};--w:{};--a:{}}}'
                 '@media (prefers-color-scheme:dark){{:root{{--b:{};--w:{};--a:{}}}}}</style>'
                 ).format(EMERALD, WHITE, GREEN_ON_LIGHT, WHITE, NEAR_BLACK, GREEN)
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
    """Logotipo horizontal ou empilhado. O ícone entra SEM ondas — ver lockup()."""
    L = lockup(100, stacked=stacked, pad=0.02)
    vb = L['vb']
    body = WHITE if white else EMERALD
    window = NEAR_BLACK if white else WHITE
    c1 = WHITE if white else EMERALD
    c2 = GREEN if white else GREEN_ON_LIGHT
    parts = ['<g transform="{}">'.format(L['mark'].svg()),
             '<path d="{}" fill="{}"/>'.format(MARK_BODY_D, body),
             '<path d="{}" fill="{}"/>'.format(MARK_WINDOW_D, window),
             '</g>']
    for text, x, color in L['runs']:
        parts.append('<path d="{}" fill="{}"/>'.format(
            TYPE.d(text, L['size'], x, L['baseline'], TRACK),
            c1 if color == EMERALD else c2))
    parts.append(accent_svg(L['accent'], c2))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="{:.2f} {:.2f} {:.2f} {:.2f}" '
            'fill="none">\n  '.format(*vb) + '\n  '.join(parts) + '\n</svg>\n')


def draw_lockup(d, L, k, off, body, window, c1, c2):
    """Rasteriza um lockup: k = escala do canvas, off = deslocamento (x, y).

    O mark vai com arcs=None: no logotipo com a palavra, quem buzina é o
    acento do "ô".
    """
    def T2(t):
        return T(t.s * k, t.tx * k + off[0], t.ty * k + off[1])

    draw_mark(d, T2(L['mark']), body, window, None)
    for text, x, color in L['runs']:
        TYPE.draw(d, text, L['size'] * k, x * k + off[0], L['baseline'] * k + off[1],
                  TRACK, c1 if color == EMERALD else c2)
    acc = L['accent']
    stroke_arcs(d, acc['cx'] * k + off[0], acc['cy'] * k + off[1],
                [r * k for r in acc['radii']], acc['w'] * k, c2, acc['a'])


def wordmark_png(path, height=260, white=False):
    L = lockup(100, pad=0.03)
    k = height / L['vb'][3]
    W = int(round(L['vb'][2] * k))
    H = int(round(L['vb'][3] * k))
    im, d = canvas(W, H)
    draw_lockup(d, L, k * SS, (-L['vb'][0] * k * SS, -L['vb'][1] * k * SS),
                rgba(WHITE if white else EMERALD),
                TRANSPARENT if white else rgba(WHITE),
                rgba(WHITE if white else EMERALD),
                rgba(GREEN if white else GREEN_ON_LIGHT))
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
                rgba(WHITE), TRANSPARENT, rgba(WHITE), rgba(GREEN))
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
        '// buzina: mesma varredura do mark e mesmo vão-sobre-traço, com o peso',
        '// recalculado pro corpo do texto.',
        'export const TEXT = {',
        "  alo: '{}',".format(TYPE.d('Alo', size, 0, 0, TRACK)),
        "  buzinou: '{}',".format(TYPE.d('Buzinou', size, buz_x, 0, TRACK)),
        '  accent: [' + ', '.join("'{}'".format(arc_path(acc0['cx'], acc0['cy'], r, acc0['a']))
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
            '  // Uma buzina por peça: no logotipo com a palavra quem buzina é o',
            '  // acento do "ô". No <LogoMark /> sozinho as ondas voltam.',
            '  markArcs: false,',
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
                     ('favicon.svg', dict(tile=True))):
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
    C = (rgba(EMERALD), rgba(WHITE), rgba(GREEN_ON_LIGHT))   # mark colorido, fundo claro
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

    # Favicon .ico: ladrilho esmeralda em todos os tamanhos — é o que dá
    # contraste em aba clara E escura, e por isso o fundo não muda. O que
    # muda é o CONTEÚDO, por degrau:
    #
    #   16 e 24  só o balão (degrau C). A perua inteira ali dava roda de
    #            1,3 px e onda de 1,0 px: dois borrões que engordavam a
    #            silhueta sem desenhar nada.
    #   32 e 48  a perua sem ondas (degrau B), em branco — em fundo
    #            esmeralda o verde não separa.
    #
    # A janela vai na COR DO FUNDO, não vazada: com alfa 0 sobre carroceria
    # branca o balão simplesmente desaparecia.
    write_ico(os.path.join(OUT, 'favicon.ico'), [
        tile_image(16, rgba(EMERALD), rgba(WHITE)),
        tile_image(24, rgba(EMERALD), rgba(WHITE)),
        icon_image(32, 0.13, rgba(EMERALD), rgba(WHITE), rgba(EMERALD), rgba(WHITE), tier='B'),
        icon_image(48, 0.13, rgba(EMERALD), rgba(WHITE), rgba(EMERALD), rgba(WHITE), tier='B'),
    ])

    print('JS')
    js_paths()


if __name__ == '__main__':
    main()
