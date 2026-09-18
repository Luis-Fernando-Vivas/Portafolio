import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

const WORDS = ['Diseña.', 'Automatiza.', 'Crece.']

const lerp = (a, b, t) => a + (b - a) * t

const CARDS = [
  {
    window: [0.0, 0.38],
    park: { x: -230, y: -30, rotateY: 20, scale: 0.68 },
    content: (
      <svg viewBox="0 0 220 150" className="card-art">
        <rect x="1" y="1" width="218" height="148" rx="12" className="art-frame" />
        <circle cx="18" cy="16" r="2.4" className="art-dot" />
        <circle cx="27" cy="16" r="2.4" className="art-dot" />
        <circle cx="36" cy="16" r="2.4" className="art-dot" />
        <line x1="14" y1="32" x2="206" y2="32" className="art-line" />
        <rect x="14" y="46" width="92" height="88" rx="6" className="art-block" />
        <rect x="114" y="46" width="92" height="18" rx="4" className="art-block-soft" />
        <rect x="114" y="72" width="92" height="10" rx="3" className="art-block-soft" />
        <rect x="114" y="90" width="70" height="10" rx="3" className="art-block-soft" />
        <rect x="114" y="112" width="56" height="18" rx="4" className="art-block" />
      </svg>
    ),
    label: 'Sitios web a medida',
  },
  {
    window: [0.31, 0.69],
    park: { x: 230, y: -50, rotateY: -16, scale: 0.8 },
    content: (
      <svg viewBox="0 0 220 150" className="card-art">
        <rect x="1" y="1" width="218" height="148" rx="12" className="art-frame" />
        <circle cx="34" cy="34" r="9" className="art-node" />
        <circle cx="110" cy="20" r="9" className="art-node" />
        <circle cx="186" cy="34" r="9" className="art-node" />
        <circle cx="72" cy="90" r="9" className="art-node" />
        <circle cx="150" cy="90" r="9" className="art-node" />
        <circle cx="110" cy="128" r="9" className="art-node-fill" />
        <path d="M34 34 L72 90" className="art-line" />
        <path d="M110 20 L72 90" className="art-line" />
        <path d="M110 20 L150 90" className="art-line" />
        <path d="M186 34 L150 90" className="art-line" />
        <path d="M72 90 L110 128" className="art-line" />
        <path d="M150 90 L110 128" className="art-line" />
      </svg>
    ),
    label: 'Automatización de procesos',
  },
  {
    window: [0.62, 1.0],
    park: null,
    content: (
      <svg viewBox="0 0 220 150" className="card-art">
        <rect x="1" y="1" width="218" height="148" rx="12" className="art-frame" />
        <line x1="24" y1="18" x2="196" y2="18" className="art-line" />
        <line x1="24" y1="126" x2="196" y2="126" className="art-line" />
        <rect x="30" y="88" width="20" height="38" rx="3" className="art-block-soft" />
        <rect x="62" y="68" width="20" height="58" rx="3" className="art-block-soft" />
        <rect x="94" y="48" width="20" height="78" rx="3" className="art-block" />
        <rect x="126" y="74" width="20" height="52" rx="3" className="art-block-soft" />
        <rect x="158" y="34" width="20" height="92" rx="3" className="art-block" />
      </svg>
    ),
    label: 'Dashboards en tiempo real',
  },
]

const WRAP_HEIGHT_VH = 320

export default function ServiceReveal() {
  const wrapRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
  })

  return (
    <section
      className="service-wrap"
      ref={wrapRef}
      style={{ height: `${WRAP_HEIGHT_VH}vh` }}
    >
      <div className="service-sticky">
        <div className="service-stage">
          {CARDS.map((card, i) => (
            <ServiceCard key={card.label} card={card} progress={scrollYProgress} zIndex={i} />
          ))}
        </div>

        <div className="service-copy">
          <h2>
            {WORDS.map((word, i) => (
              <Word key={word} word={word} index={i} card={CARDS[i]} progress={scrollYProgress} />
            ))}
          </h2>
          <p>
            Diseñamos el sitio, montamos los flujos que lo mantienen andando y te damos
            visibilidad de lo que está pasando — todo pensado para tu operación, no una
            plantilla genérica.
          </p>
        </div>
      </div>
    </section>
  )
}

function Word({ word, index, card, progress }) {
  const [start, end] = card.window
  const riseEnd = lerp(start, end, 0.35)
  const color = useTransform(progress, [start, riseEnd], ['#4a4a4a', '#ffffff'], { clamp: true })
  return (
    <motion.span style={{ color }}>
      {word}
      {index < 2 ? ' ' : ''}
    </motion.span>
  )
}

function ServiceCard({ card, progress, zIndex }) {
  const [start, end] = card.window
  const riseEnd = lerp(start, end, 0.35)
  const holdEnd = lerp(start, end, 0.65)
  const stops = [start, riseEnd, holdEnd, end]

  const opacity = useTransform(progress, [start, riseEnd], [0, 1], { clamp: true })
  const rotateX = useTransform(progress, [start, riseEnd], [64, 0], { clamp: true })
  const scale = useTransform(progress, stops, [0.62, 1, 1, card.park ? card.park.scale : 1], {
    clamp: true,
  })
  const x = useTransform(progress, stops, [0, 0, 0, card.park ? card.park.x : 0], { clamp: true })
  const y = useTransform(progress, stops, [0, 0, 0, card.park ? card.park.y : 0], { clamp: true })
  const rotateY = useTransform(progress, stops, [0, 0, 0, card.park ? card.park.rotateY : 0], {
    clamp: true,
  })
  const z = useTransform(progress, [holdEnd, end], [0, card.park ? -180 : 0], { clamp: true })

  return (
    <motion.figure
      className="service-card"
      style={{
        opacity,
        scale,
        x,
        y,
        z,
        rotateX,
        rotateY,
        zIndex,
        transformOrigin: 'center bottom',
      }}
    >
      {card.content}
    </motion.figure>
  )
}
