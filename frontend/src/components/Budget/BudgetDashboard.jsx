import { useState, useEffect } from 'react'
import { useAuth } from '../../auth.jsx'

const EUR = v => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)
const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

function BudgetBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(value / max * 100, 100) : 0
  return (
    <div style={{ marginBottom: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem', color: 'var(--color-text-light)' }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color }}>{EUR(value)}</span>
      </div>
      <div style={{ height: '8px', background: 'var(--color-gray)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export default function BudgetDashboard() {
  const { fetchWithAuth } = useAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [data, setData] = useState(null)
  const [validationData, setValidationData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchWithAuth('/api/stammdaten/projects')
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        const withBudget = list.filter(p => p.budget_eur != null)
        setProjects(withBudget)
        if (withBudget.length > 0) setProjectId(withBudget[0].id)
      })
  }, [])

  useEffect(() => {
    if (projectId) loadDashboard()
  }, [projectId, year])

  useEffect(() => {
    loadValidation()
  }, [year])

  async function loadDashboard() {
    setLoading(true)
    try {
      const resp = await fetchWithAuth(`/api/zeitplanung/budget-dashboard?project_id=${projectId}&year=${year}`)
      if (resp.ok) setData(await resp.json())
    } finally {
      setLoading(false)
    }
  }

  async function loadValidation() {
    const resp = await fetchWithAuth(`/api/zeitplanung/budget-validation-eur?year=${year}`)
    if (resp.ok) setValidationData(await resp.json())
  }

  const chartMax = data
    ? Math.max(data.project.budget_eur, ...data.months.map(m => Math.max(m.cumulative_plan_eur, m.cumulative_actual_eur)), 1)
    : 1

  // SVG line chart dimensions
  const W = 700, H = 200, PAD = { top: 10, right: 20, bottom: 30, left: 60 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  function toX(month) {
    return PAD.left + ((month - 1) / 11) * innerW
  }
  function toY(value) {
    return PAD.top + innerH - (value / chartMax) * innerH
  }
  function pointsStr(arr, key) {
    return arr.map(m => `${toX(m.month)},${toY(m[key])}`).join(' ')
  }

  return (
    <div className="page-content">
      {/* Header + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-white)', borderRadius: '6px', padding: '0.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setYear(y => y - 1)}>‹</button>
          <span style={{ padding: '0.25rem 0.75rem', fontWeight: 600, fontSize: '0.95rem', lineHeight: '1.8' }}>{year}</span>
          <button className="btn btn-sm btn-secondary" onClick={() => setYear(y => y + 1)}>›</button>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '280px' }}>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ marginBottom: 0 }}>
            <option value="">— Projekt wählen —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.customers?.name ? `${p.customers.name} / ` : ''}{p.name}</option>
            ))}
          </select>
        </div>
        {projects.length === 0 && (
          <span style={{ color: 'var(--color-text-light)', fontSize: '0.875rem' }}>
            Keine Projekte mit EUR-Budget gefunden. Budget in den Stammdaten hinterlegen.
          </span>
        )}
      </div>

      {/* Project Dashboard */}
      {data && !loading && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projekt-Budget</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)', marginTop: '0.25rem' }}>{EUR(data.project.budget_eur)}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>{data.project.customer_name} / {data.project.name}</div>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plan gesamt</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)', marginTop: '0.25rem' }}>
                  {EUR(data.months[11].cumulative_plan_eur)}
                </div>
                <div style={{ fontSize: '0.82rem', color: data.months[11].cumulative_plan_eur > data.project.budget_eur ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {data.months[11].cumulative_plan_eur > data.project.budget_eur ? '▲ über Budget' : '✓ im Budget'}
                </div>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ist (genehmigt)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-dark)', marginTop: '0.25rem' }}>
                  {EUR(data.months[11].cumulative_actual_eur)}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
                  {data.project.budget_eur > 0
                    ? `${Math.round(data.months[11].cumulative_actual_eur / data.project.budget_eur * 100)} % verbraucht`
                    : '—'}
                </div>
              </div>
            </div>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-body">
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Forecast Jahresende</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: data.forecast.projected_over_budget ? 'var(--color-error)' : 'var(--color-success)', marginTop: '0.25rem' }}>
                  {EUR(data.forecast.projected_annual_eur)}
                </div>
                <div style={{ fontSize: '0.82rem', color: data.forecast.projected_over_budget ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {data.forecast.projected_over_budget ? '▲' : '▼'} {EUR(Math.abs(data.forecast.projected_delta_eur))} {data.forecast.projected_over_budget ? 'über' : 'unter'} Budget
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <div className="card-header">Kumulierter Verlauf — Plan vs. Ist vs. Budget</div>
            <div className="card-body" style={{ overflowX: 'auto' }}>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: `${W}px`, height: `${H}px` }}>
                {/* Budget line */}
                <line
                  x1={PAD.left} y1={toY(data.project.budget_eur)}
                  x2={W - PAD.right} y2={toY(data.project.budget_eur)}
                  stroke="var(--color-error)" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.6"
                />
                <text x={W - PAD.right + 4} y={toY(data.project.budget_eur) + 4} fontSize="10" fill="var(--color-error)" opacity="0.8">Budget</text>

                {/* Plan line */}
                <polyline
                  points={pointsStr(data.months, 'cumulative_plan_eur')}
                  fill="none" stroke="var(--color-dark)" strokeWidth="2" opacity="0.5"
                />

                {/* Actual line */}
                <polyline
                  points={pointsStr(data.months.filter(m => m.cumulative_actual_eur > 0), 'cumulative_actual_eur')}
                  fill="none" stroke="var(--color-primary)" strokeWidth="2.5"
                />

                {/* Forecast dot */}
                {data.forecast.projected_annual_eur > 0 && (
                  <circle cx={toX(12)} cy={toY(data.forecast.projected_annual_eur)} r="5"
                    fill={data.forecast.projected_over_budget ? 'var(--color-error)' : 'var(--color-success)'} opacity="0.8"
                  />
                )}

                {/* X axis labels */}
                {data.months.map((m, i) => (
                  <text key={i} x={toX(m.month)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--color-text-light)">{MONTHS[i]}</text>
                ))}

                {/* Y axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map(f => {
                  const val = chartMax * f
                  return (
                    <g key={f}>
                      <line x1={PAD.left - 4} y1={toY(val)} x2={W - PAD.right} y2={toY(val)} stroke="var(--color-gray)" strokeWidth="0.5" />
                      <text x={PAD.left - 8} y={toY(val) + 4} textAnchor="end" fontSize="9" fill="var(--color-text-light)">
                        {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
                      </text>
                    </g>
                  )
                })}
              </svg>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-block', width: '20px', height: '3px', background: 'var(--color-dark)', opacity: 0.5 }} />Plan
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-block', width: '20px', height: '3px', background: 'var(--color-primary)' }} />Ist
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-block', width: '20px', height: '2px', background: 'var(--color-error)', opacity: 0.6 }} />Budget
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)' }} />Forecast
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Detail */}
          <div className="card">
            <div className="card-header">Monatliche Aufstellung</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Monat</th>
                    <th style={{ textAlign: 'right' }}>Plan (monatl.)</th>
                    <th style={{ textAlign: 'right' }}>Ist (monatl.)</th>
                    <th style={{ textAlign: 'right' }}>Kumuliert Plan</th>
                    <th style={{ textAlign: 'right' }}>Kumuliert Ist</th>
                    <th style={{ textAlign: 'right' }}>vs. Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m, i) => {
                    const delta = m.cumulative_actual_eur - data.project.budget_eur
                    return (
                      <tr key={m.month}>
                        <td>{MONTHS[i]}</td>
                        <td className="num">{m.plan_eur > 0 ? EUR(m.plan_eur) : '—'}</td>
                        <td className="num">{m.actual_eur > 0 ? EUR(m.actual_eur) : '—'}</td>
                        <td className="num" style={{ color: 'var(--color-dark)' }}>{m.cumulative_plan_eur > 0 ? EUR(m.cumulative_plan_eur) : '—'}</td>
                        <td className="num" style={{ fontWeight: m.cumulative_actual_eur > 0 ? 600 : 'normal', color: m.cumulative_actual_eur > 0 ? 'var(--color-primary)' : 'var(--color-text-light)' }}>
                          {m.cumulative_actual_eur > 0 ? EUR(m.cumulative_actual_eur) : '—'}
                        </td>
                        <td className="num" style={{ color: m.cumulative_actual_eur > 0 ? (delta > 0 ? 'var(--color-error)' : 'var(--color-success)') : 'var(--color-text-light)' }}>
                          {m.cumulative_actual_eur > 0 ? (delta > 0 ? `+${EUR(delta)}` : EUR(delta)) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {loading && <div className="loading"><div className="loading-spinner" /></div>}

      {/* Budget-Validierung alle Projekte */}
      {validationData.length > 0 && (
        <div className="card">
          <div className="card-header">Budget-Kontrolle — alle Projekte ({year})</div>
          <div className="card-body" style={{ borderBottom: '1px solid var(--color-gray)', fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
            Abgleich: geplante EUR (Stunden × Stundensatz + Reisekosten) vs. Projekt-Budget
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Projekt</th>
                  <th>Kunde</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'right' }}>Geplant</th>
                  <th style={{ textAlign: 'right' }}>Abweichung</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {validationData.map(v => (
                  <tr key={v.project_id}>
                    <td style={{ fontWeight: 600 }}>{v.project_name}</td>
                    <td style={{ color: 'var(--color-text-light)' }}>{v.customer_name}</td>
                    <td className="num">{v.budget_eur > 0 ? EUR(v.budget_eur) : '—'}</td>
                    <td className="num">{EUR(v.planned_eur)}</td>
                    <td className="num" style={{ fontWeight: 600, color: v.over_budget ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {v.delta_eur > 0 ? `+${EUR(v.delta_eur)}` : EUR(v.delta_eur)}
                    </td>
                    <td className="num" style={{ color: v.over_budget ? 'var(--color-error)' : 'var(--color-success)' }}>
                      {v.delta_pct > 0 ? `+${v.delta_pct}` : v.delta_pct}%
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {v.budget_eur > 0
                        ? <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: v.over_budget ? 'var(--color-error)' : 'var(--color-success)' }} title={v.over_budget ? 'Über Budget' : 'Im Budget'} />
                        : <span style={{ color: 'var(--color-text-light)' }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
