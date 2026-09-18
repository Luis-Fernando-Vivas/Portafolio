import IntroNav from './IntroNav'
import ServiceReveal from './ServiceReveal'
import './Hero.css'

export default function Hero() {
  return (
    <div className="hero-root" id="top">
      <IntroNav />
      <div className="intro-spacer" aria-hidden="true" />
      <ServiceReveal />
      <section className="hero-end">
        <p>↓ sigue construyendo aquí abajo</p>
      </section>
    </div>
  )
}
