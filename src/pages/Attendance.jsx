import { useState } from 'react'
import { api } from '../api'
import { Badge, Person, Card, ErrorBox, LABEL, PageHead, Table, Tabs, num, today, useApi, useApp, useModal, useUrlState } from '../ui'

const KINDS = ['present', 'early_leave', 'annual_leave', 'absent']

export default function Attendance() {
  const { scope, toast } = useApp()
  const [modal, open] = useModal()
  const [tab, setTab] = useUrlState('tab', 'daily')
  const [day, setDay] = useState(today())
  const [error, setError] = useState(null)
  const q = { project_code: scope.project_code, department_code: scope.department_code }
  const daily = useApi(tab === 'daily' ? '/api/attendance/daily' : null, { ...q, work_date: day })
  const people = useApi(tab === 'daily' ? '/api/participants' : null, { ...q, as_of: day, status: 'active' })
  const monthly = useApi(tab === 'monthly' ? '/api/attendance/monthly' : null, { ...q, work_month: scope.work_month })

  // 참여자 목록에 그날 기록을 합쳐 한 화면에서 입력
  const byPid = Object.fromEntries((daily.data || []).map((a) => [a.participation_id, a]))
  const rows = (people.data || []).map((p) => ({ ...p, rec: byPid[p.participation_id] }))

  const set = async (p, kind) => {
    if (kind === 'early_leave') return early(p)
    setError(null)
    try {
      if (p.rec) await api.patch(`/api/attendance/${p.rec.id}`, { kind })
      else await api.post('/api/attendance', { participation_id: p.participation_id, work_date: day, kind })
      daily.reload()
    } catch (e) {
      // 마감 후 정정은 사유가 필요하다
      if (p.rec && e.status === 422) open({
        title: '마감 후 정정', intro: e.message, fields: [{ name: 'reason', label: '정정 사유', required: true, type: 'textarea' }],
        onSubmit: async (v) => { await api.patch(`/api/attendance/${p.rec.id}`, { kind, reason: v.reason }); daily.reload() },
      })
      else setError(e)
    }
  }
  const early = (p) => open({
    title: `${p.name} 조퇴`, fields: [{ name: 'early_leave_hours', label: '조퇴 시간', type: 'number', step: '0.5', required: true }, ...(p.rec ? [{ name: 'reason', label: '정정 사유 (마감 후 필수)' }] : [])],
    onSubmit: async (v) => {
      const body = { kind: 'early_leave', early_leave_hours: v.early_leave_hours }
      if (p.rec) await api.patch(`/api/attendance/${p.rec.id}`, { ...body, reason: v.reason || null })
      else await api.post('/api/attendance', { ...body, participation_id: p.participation_id, work_date: day })
      daily.reload()
    },
  })

  const markAll = async () => {
    const todo = rows.filter((r) => !r.rec)
    try {
      for (const p of todo) await api.post('/api/attendance', { participation_id: p.participation_id, work_date: day, kind: 'present' })
      toast(`${todo.length}명을 출근으로 입력했습니다.`)
    } catch (e) { setError(e) }
    daily.reload()
  }

  return (
    <>
      <PageHead tag="FN-12" title="전자출석" desc="부서 담당자가 배치 범위 안의 참여자 출결을 하루 단위로 입력합니다." />
      <Tabs value={tab} onChange={setTab} tabs={[['daily', '일별 입력'], ['monthly', '월별 집계']]} />
      <ErrorBox error={error || daily.error} />
      {tab === 'daily' ? (
        <Card title={<input type="date" className="input" value={day} onChange={(e) => setDay(e.target.value)} aria-label="근무일" />}
          actions={<>
            <span className="muted">입력 {daily.data?.length ?? 0} / {rows.length}명</span>
            <button className="btn primary sm" disabled={!rows.some((r) => !r.rec)} onClick={markAll}>미입력자 전원 출근</button>
          </>}>
          <Table {...people} rows={rows} empty="이 날짜에 재직 중인 참여자가 없습니다." columns={[
            { key: 'name', label: '성명', render: (r) => <Person name={r.name} /> },
            { key: 'department_code', label: '부서' },
            { key: 'contract_hours', label: '계약', num: true, render: (r) => (r.contract_hours == null ? "-" : `${r.contract_hours}h`) },
            { key: 'st', label: '현재', render: (r) => (r.rec ? <Badge v={r.rec.kind} /> : <span className="muted">미입력</span>) },
            { key: 'h', label: '인정 시간', num: true, render: (r) => r.rec?.recognized_hours ?? '-' },
            { key: 'a', label: '출결 입력', render: (r) => (
              <div className="actions">
                {KINDS.map((k) => (
                  <button key={k} className={`btn sm${r.rec?.kind === k ? ' primary' : ''}`} onClick={() => set(r, k)}>{LABEL[k][0]}</button>
                ))}
              </div>) },
          ]} />
        </Card>
      ) : (
        <Card title={`${scope.work_month} 월별 집계`}>
          <Table {...monthly} rows={monthly.data} empty="이 달 출결 기록이 없습니다." columns={[
            { key: 'name', label: '성명' }, { key: 'department_code', label: '부서' },
            { key: 'work_days', label: '근무일', num: true }, { key: 'recognized_hours', label: '인정 시간', num: true, render: (r) => num(r.recognized_hours) },
            { key: 'early_leave_hours', label: '조퇴 시간', num: true }, { key: 'annual_leave_days', label: '연차', num: true }, { key: 'absent_days', label: '결근', num: true },
          ]} />
        </Card>
      )}
      {modal}
    </>
  )
}
