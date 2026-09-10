import { useState } from "react"

interface Props { onFocus: () => void; onNotes: () => void }

export default function WorkspaceHero({ onFocus, onNotes }: Props) {
  const [motion, setMotion] = useState(() => localStorage.getItem("chroninotes-spatial-motion") !== "false")
  const toggleMotion = () => {
    const next = !motion
    setMotion(next)
    localStorage.setItem("chroninotes-spatial-motion", String(next))
  }

  return (
    <section className="spatial-hero" data-motion={motion ? "on" : "off"} aria-labelledby="spatial-title">
      <div className="spatial-hero-copy">
        <p className="spatial-eyebrow">YOUR PERSONAL WORKSPACE</p>
        <h1 id="spatial-title">Less noise.<br /><span>More possibility.</span></h1>
        <p className="spatial-description">Your ideas, your plans, your next big thing.<br />One space to bring it all together.</p>
        <div className="spatial-actions">
          <button className="spatial-button spatial-button-primary" onClick={onFocus}>Open focus studio <span aria-hidden="true">↗</span></button>
          <button className="spatial-button" onClick={onNotes}>Explore your notes</button>
        </div>
        <button className="spatial-motion-toggle" onClick={toggleMotion} aria-pressed={motion}
          title="System reduced-motion preferences always take priority">3D motion {motion ? "on" : "off"}</button>
      </div>
      <div className="spatial-scene" aria-hidden="true">
        <div className="spatial-grid" />
        <div className="spatial-stack">
          <div className="spatial-layer spatial-layer-back" />
          <div className="spatial-layer spatial-layer-middle" />
          <div className="spatial-layer spatial-layer-front">
            <span className="spatial-mark">✦</span>
            <span className="spatial-line spatial-line-long" />
            <span className="spatial-line" />
            <span className="spatial-check">✓</span>
          </div>
        </div>
        <span className="spatial-caption">SPACE TO THINK. ROOM TO GROW.</span>
      </div>
    </section>
  )
}
