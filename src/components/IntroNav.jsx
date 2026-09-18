import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

const BAR_H = 72
const PAD = 28
const INTRO_SCROLL_DIST = 160

const ICON_RATIO = 557 / 465 // height / width
const WORD_RATIO = 191 / 1321 // height / width
const ICON_TO_WORD_H = 1.45 // icon height as a multiple of the wordmark height, kept constant at any scale

const ICON_TOP_BIG = 100
const GAP_BIG = 12
const GAP_SMALL = 10

const WORD_SMALL_H = 22

const NAV_LINKS = [
  { label: 'Servicios', startFrac: 0.06, endRight: 300 },
  { label: 'Proceso', startFrac: 0.48, endRight: 168 },
  { label: 'Contacto', startFrac: 0.9, endRight: 32 },
]

const lerp = (a, b, t) => a + (b - a) * t

const measureCanvas = document.createElement('canvas')
const measureCtx = measureCanvas.getContext('2d')

function measureTextWidth(text, font, letterSpacing = 0) {
  measureCtx.font = font
  const base = measureCtx.measureText(text).width
  return base + letterSpacing * (text.length - 1)
}

const NAV_FONT = "500 15.5px 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif"

export default function IntroNav() {
  const sizeRef = useRef({ vw: window.innerWidth, vh: window.innerHeight })
  const { scrollY } = useScroll()

  useEffect(() => {
    const update = () => {
      sizeRef.current = { vw: window.innerWidth, vh: window.innerHeight }
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const progress = useTransform(scrollY, (v) => {
    return Math.min(Math.max(v / INTRO_SCROLL_DIST, 0), 1)
  })

  const geometryAt = (p) => {
    const { vw } = sizeRef.current

    const wordBigW = Math.min(vw * 0.92, 1600)
    const wordBigH = wordBigW * WORD_RATIO
    const iconBigH = wordBigH * ICON_TO_WORD_H
    const iconBigW = iconBigH / ICON_RATIO

    const iconSmallH = WORD_SMALL_H * ICON_TO_WORD_H
    const iconSmallW = iconSmallH / ICON_RATIO

    const wordH = lerp(wordBigH, WORD_SMALL_H, p)
    const wordW = wordH / WORD_RATIO
    const iconW = lerp(iconBigW, iconSmallW, p)
    const iconH = iconW * ICON_RATIO

    const iconBigLeft = (vw - iconBigW) / 2
    const wordBigLeft = (vw - wordBigW) / 2
    const wordBigTop = ICON_TOP_BIG + iconBigH + GAP_BIG

    const iconSmallTop = (BAR_H - iconSmallH) / 2
    const wordSmallTop = (BAR_H - WORD_SMALL_H) / 2
    const wordSmallLeft = PAD + iconSmallW + GAP_SMALL

    return {
      iconW,
      iconH,
      iconTop: lerp(ICON_TOP_BIG, iconSmallTop, p),
      iconLeft: lerp(iconBigLeft, PAD, p),
      wordW,
      wordH,
      wordTop: lerp(wordBigTop, wordSmallTop, p),
      wordLeft: lerp(wordBigLeft, wordSmallLeft, p),
    }
  }

  const iconWidth = useTransform(progress, (p) => geometryAt(p).iconW)
  const iconTop = useTransform(progress, (p) => geometryAt(p).iconTop)
  const iconLeft = useTransform(progress, (p) => geometryAt(p).iconLeft)
  const wordWidth = useTransform(progress, (p) => geometryAt(p).wordW)
  const wordTop = useTransform(progress, (p) => geometryAt(p).wordTop)
  const wordLeft = useTransform(progress, (p) => geometryAt(p).wordLeft)

  const barOpacity = useTransform(progress, [0.85, 1], [0, 1], { clamp: true })
  const scrollHintOpacity = useTransform(progress, [0, 0.12], [1, 0], { clamp: true })

  return (
    <header className="intro-nav">
      <motion.div className="intro-nav-bg" style={{ opacity: barOpacity }} />

      <motion.a
        href="#top"
        className="intro-logo-icon"
        style={{ top: iconTop, left: iconLeft, width: iconWidth }}
      >
        <img src="/automind_icono.webp" alt="" />
      </motion.a>

      <motion.a
        href="#top"
        className="intro-logo-word"
        style={{ top: wordTop, left: wordLeft, width: wordWidth }}
      >
        <img src="/automind_logo.webp" alt="automind" />
      </motion.a>

      <div className="intro-links">
        {NAV_LINKS.map((link) => (
          <NavLink key={link.label} link={link} progress={progress} sizeRef={sizeRef} />
        ))}
      </div>

      <motion.div className="scroll-hint" style={{ opacity: scrollHintOpacity }}>
        Scroll down ↓
      </motion.div>
    </header>
  )
}

function NavLink({ link, progress, sizeRef }) {
  const textWidth = measureTextWidth(link.label, NAV_FONT)
  const left = useTransform(progress, (p) => {
    const { vw } = sizeRef.current
    const startLeft = vw * link.startFrac
    const endLeft = vw - link.endRight - textWidth
    return lerp(startLeft, endLeft, p)
  })

  return (
    <motion.a href="#" className="intro-link" style={{ left }}>
      {link.label}
    </motion.a>
  )
}
