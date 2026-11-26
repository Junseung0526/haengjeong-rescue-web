import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../api'
import { Badge, Card, ErrorBox, Modal, PageHead, REASON, Stat, Table, Tabs, dt, useApi, useApp, useDeptNames, useModal, useUrlState } from '../ui'

const DATES = [
  { name: 'request_date', label: '제출 요청일', type: 'date', required: true },
  { name: 'due_date', label: '제출 마감일', type: 'date', required: true },
  { name: 'final_reminder_date', label: '최종 독촉일', type: 'date', required: true },
  { name: 'payment_date', label: '지급일', type: 'date', required: true },
]
const STAGE = { request: '요청', due: '마감', final_reminder: '최종 독촉' }

export default function Deadlines() {
  const { scope } = useApp()
  const [modal, open] = useModal()
  const [sel, setSel] = useState(null)
  const list = useApi('/api/deadlines', { project_code: scope.project_code })

  const create = () => open({
    title: '마감 일정 등록', cols: true,
    intro: '사업·업무월당 한 건입니다. 일정에 맞춰 미제출 부서에 독촉 알림이 갑니다.',
    initial: { project_code: scope.project_code, work_month: scope.work_month },
    fields: [{ name: 'project_code', label: '사업코드', required: true }, { name: 'work_month', label: '업무월', type: 'month', required: true }, ...DATES],
    onSubmit: async (v) => { await api.post('/api/deadlines', v); list.reload() },
  })
  const edit = (s) => open({
    title: `${s.work_month} 일정 수정`, cols: true, initial: s, fields: [...DATES, REASON],
    onSubmit: async ({ request_date, due_date, final_reminder_date, payment_date, reason }) => {
      await api.put(`/api/deadlines/${s.id}`, { request_date, due_date, final_reminder_date, payment_date, reason })
      list.reload()
    },
  })

  return (
    <>
      <PageHead tag="FN-15" title="마감·독촉 관리" desc="월별 제출 일정과 부서별 제출 현황을 관리합니다. 행을 누르면 현황을 봅니다.">
        <button className="btn primary" onClick={create}><Plus size={16} />일정 등록</button>
      </PageHead>
      <Card>
        <Table {...list} rows={list.data} onRow={setSel} empty="등록된 일정이 없습니다." columns={[
          { key: 'project_code', label: '사업' }, { key: 'work_month', label: '업무월', render: (r) => <b>{r.work_month}</b> },
          { key: 'request_date', label: '요청일' }, { key: 'due_date', label: '마감일' },
          { key: 'final_reminder_date', label: '최종 독촉' }, { key: 'payment_date', label: '지급일' },
          { key: 'a', label: '', render: (r) => <button className="btn sm" onClick={(e) => { e.stopPropagation(); edit(r) }}>수정</button> },
        ]} />
      </Card>
      {sel && <Status s={sel} onClose={() => setSel(null)} />}
      {modal}
    </>
  )
}

function Status({ s, onClose }) {
  const depts = useDeptNames()
  const [modal, open] = useModal()
  const [tab, setTab] = useUrlState('tab', 'status')
  const status = useApi(`/api/deadlines/${s.id}/submission-status`)
  const targets = useApi(`/api/deadlines/${s.id}/submission-targets`)
  const reminders = useApi(tab === 'reminders' ? `/api/deadlines/${s.id}/reminders` : null)
  const t = targets.data
  const rev = t?.revision ?? 0
  const reload = () => { status.reload(); targets.reload() }

  const refresh = () => open({
    title: '제출 대상 자동 선정', intro: '수동 조정과 확정 결과는 보존하며 다시 선정합니다.', fields: [REASON], submitLabel: '선정',
    onSubmit: async (v) => { await api.post(`/api/deadlines/${s.id}/submission-targets/refresh`, { ...v, expected_revision: rev }); reload() },
  })
  const confirmT = () => open({
    title: '제출 대상 확정', fields: [REASON], submitLabel: '확정',
    onSubmit: async (v) => { await api.post(`/api/deadlines/${s.id}/submission-targets/confirm`, { ...v, expected_revision: rev }); reload() },
  })
  const adjust = (d) => open({
    title: `${depts?.get(d.department_code) ?? d.department_code} 대상 조정`,
    initial: { manual_override: d.manual_override || '' },
    fields: [{ name: 'manual_override', label: '조정', type: 'select', options: [['include', '포함'], ['exclude', '제외']], hint: '선택 안 함이면 자동 기준으로 복귀' }, REASON],
    onSubmit: async (v) => { await api.put(`/api/deadlines/${s.id}/submission-targets/${d.department_code}`, { expected_revision: rev, reason: v.reason, manual_override: v.manual_override || null }); reload() },
  })

  const sum = status.data?.summary
  const notFound = status.error?.status === 404 || status.error?.status === 422
  return (
    <Modal wide title={`${s.project_code} · ${s.work_month} 제출 현황`} onClose={onClose}
      footer={<><button className="btn" onClick={refresh}>대상 자동 선정</button><button className="btn primary" disabled={!t || !t.has_unconfirmed_changes && t.confirmed_revision !== null} onClick={confirmT}>대상 확정</button></>}>
      {t?.has_unconfirmed_changes && <div className="alert warn">확정하지 않은 대상 변경이 있습니다.</div>}
      {notFound ? <div className="alert info">제출 대상을 선정하고 확정하면 현황이 나옵니다.</div> : <ErrorBox error={status.error} />}
      {sum && (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Stat label="대상 부서" value={sum.total_departments} unit="곳" />
          <Stat label="제출률" value={Number(sum.submission_rate).toFixed(0)} unit="%" />
          <Stat label="승인률" value={Number(sum.approval_rate).toFixed(0)} unit="%" />
          <Stat label="기한 초과" value={sum.overdue_departments} unit="곳" attn={sum.overdue_departments > 0} />
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[['status', '부서별 현황'], ['targets', `대상 선정 (개정 ${rev})`], ['reminders', '독촉 이력']]} />
      <div className="card">
        {tab === 'status' && <Table {...status} error={null} rows={status.data?.departments} empty="확정된 대상이 없습니다." columns={[
          { key: 'department_code', label: '부서' },
          { key: 'display_status', label: '상태', render: (r) => <Badge v={r.display_status} /> },
          { key: 'latest_version', label: '버전', render: (r) => (r.latest_version ? `v${r.latest_version}` : '-') },
          { key: 'submitted_at', label: '제출 시각', render: (r) => dt(r.submitted_at) },
          { key: 'late', label: '', render: (r) => r.submitted_late && <Badge v="needs_review">늦은 제출</Badge> },
        ]} />}
        {tab === 'targets' && <Table {...targets} error={null} rows={t?.departments} empty="자동 선정을 먼저 실행하세요." columns={[
          { key: 'department_code', label: '부서' },
          { key: 'auto_selected', label: '자동 선정', render: (r) => (r.auto_selected ? '대상' : '-') },
          { key: 'manual_override', label: '수동 조정', render: (r) => (r.manual_override === 'include' ? '포함' : r.manual_override === 'exclude' ? '제외' : '-') },
          { key: 'candidate_included', label: '후보', render: (r) => (r.candidate_included ? <Badge v="submitted">포함</Badge> : <Badge v="x">제외</Badge>) },
          { key: 'confirmed_included', label: '확정', render: (r) => (r.confirmed_included === null ? '-' : r.confirmed_included ? '포함' : '제외') },
          { key: 'a', label: '', render: (r) => <button className="btn sm" onClick={() => adjust(r)}>조정</button> },
        ]} />}
        {tab === 'reminders' && <Table {...reminders} rows={reminders.data?.items} empty="보낸 독촉이 없습니다." columns={[
          { key: 'department_code', label: '부서' }, { key: 'stage', label: '단계', render: (r) => STAGE[r.stage] },
          { key: 'scheduled_date', label: '예정일' }, { key: 'sent_at', label: '발송', render: (r) => dt(r.sent_at) },
          { key: 'submission_status', label: '당시 상태', render: (r) => <Badge v={r.submission_status} /> },
        ]} />}
      </div>
      {modal}
    </Modal>
  )
}
