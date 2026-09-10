interface Props {
  eyebrow: string
  title: string
  description: string
  stats: { label: string; value: number }[]
}

export default function StudioHeader({ eyebrow, title, description, stats }: Props) {
  return (
    <header className="studio-header">
      <div className="studio-header-copy">
        <p className="studio-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="studio-description">{description}</p>
      </div>
      <dl className="studio-stats">
        {stats.map(stat => (
          <div key={stat.label} className="studio-stat">
            <dt>{stat.label}</dt><dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  )
}
