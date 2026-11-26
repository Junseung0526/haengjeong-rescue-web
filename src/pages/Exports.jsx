import { useState } from 'react'
import { api } from '../api'
import { Badge, Card, PageHead, Table, Tabs, useApi, useApp, useModal, won, useUrlState } from '../ui'

const FILE_PATH = {
  'EX-01': '/api/exports/EX-01/file',
  'EX-02-ACQ': '/api/exports/EX-02/acquisition/file',
  'EX-02-LOSS': '/api/exports/EX-02/loss/file',
  'EX-03': '/api/exports/EX-03/file',
  'EX-04': '/api/exports/EX-04/file',
  'EX-05': '/api/exports/EX-05/file',
  'FN16-INSARANG': '/api/bulk-registration/FN16-INSARANG/file',
  'FN16-ILMOA': '/api/bulk-registration/FN16-ILMOA/file',
}
const PROJECT_ONLY = ['EX-01', 'EX-05']

export default function Exports() {
  const { scope } = useApp()
  const [modal, open] = useModal()
  const [tab, setTab] = useUrlState('tab', 'formats')
  const ex = useApi('/api/exports/formats')
  const bulk = useApi('/api/bulk-registration/formats')
  const formats = [...(ex.data || []), ...(bulk.data || []).map((f) => ({ ...f, contains_pii: true }))]

  const make = (f) => {
    const pii = f.contains_pii
    open({
      title: `${f.name} 만들기`,
      intro: pii ? '주민번호가 들어가 출력 권한·사유·파일 암호가 필요하고 감사 로그에 남습니다.' : `${scope.project_code || '조회 가능한 모든 사업'} · ${scope.work_month}`,
      initial: { department_code: scope.department_code },
      fields: [
        !PROJECT_ONLY.includes(f.code) && { name: 'department_code', label: '부서코드', hint: '비우면 사업 전체' },
        pii && { name: 'reason', label: '출력 사유', required: true, type: 'textarea' },
        pii && { name: 'file_password', label: '파일 암호', type: 'password', required: true, hint: '8자 이상. 받는 사람에게 따로 전달하세요.' },
      ],
      submitLabel: '내려받기',
      onSubmit: async (v) => {
        if (f.code !== 'EX-05' && !scope.project_code) throw new Error('상단에서 사업을 선택하세요.')
        const body = f.code === 'EX-05'
          ? { work_month: scope.work_month, project_code: scope.project_code || null }
          : { project_code: scope.project_code, work_month: scope.work_month, department_code: v.department_code || null, reason: v.reason, file_password: v.file_password }
        const { name } = await api.download(FILE_PATH[f.code], body)
        return `${name} 파일을 내려받았습니다.`
      },
    })
  }

  return (
    <>
      <PageHead tag="FN-07 · FN-16" title="제출 양식 출력" desc={`공단·일모아·인사랑 제출 파일을 만듭니다. 기준: ${scope.project_code || '사업 미선택'} · ${scope.work_month}`} />
      <Tabs value={tab} onChange={setTab} tabs={[['formats', '양식'], ['ex02', '자격 취득·상실 신고'], ['bulk', '일괄 등록 대상']]} />
      {tab === 'formats' && (
        <Card>
          <Table loading={ex.loading} error={ex.error} rows={formats} columns={[
            { key: 'code', label: '코드', render: (r) => <span className="mono">{r.code}</span> },
            { key: 'name', label: '양식', render: (r) => <><b>{r.name}</b> {!r.confirmed && <Badge v="needs_review">임시 양식</Badge>}</> },
            { key: 'effective_year', label: '기준 연도' },
            { key: 'pii', label: '개인정보', render: (r) => (r.contains_pii ? <Badge v="rejected">주민번호 포함</Badge> : '-') },
            { key: 'cols', label: '열', num: true, render: (r) => r.columns.length },
            { key: 'a', label: '', render: (r) => <button className="btn sm primary" onClick={() => make(r)}>파일 만들기</button> },
          ]} />
        </Card>
      )}
      {tab === 'ex02' && <Ex02 />}
      {tab === 'bulk' && <Bulk />}
      {modal}
    </>
  )
}

function Ex02() {
  const { scope, toast } = useApp()
  const t = useApi(scope.project_code ? '/api/exports/EX-02/targets' : null, { project_code: scope.project_code, work_month: scope.work_month, department_code: scope.department_code })
  if (!scope.project_code) return <div className="alert info">상단에서 사업을 선택하세요.</div>
  const mark = async (kind, rows) => {
    const ids = rows.filter((r) => !r.reported).map((r) => r.participation_id)
    if (!ids.length || !confirm(`${ids.length}명을 공단 신고 완료로 표시합니다. 이후 신고 파일에서 빠집니다.`)) return
    try { await api.post('/api/exports/EX-02/reports', { kind, participation_ids: ids }); toast('신고 완료로 표시했습니다.'); t.reload() } catch (e) { toast(e.message, 'error') }
  }
  const cols = [
    { key: 'name', label: '성명', render: (r) => <><b>{r.name}</b> <span className="mono">{r.resident_num_masked}</span></> },
    { key: 'department_code', label: '부서' },
    { key: 'report_date', label: '신고 기준일' },
    { key: 'monthly_pay', label: '월 보수', num: true, render: (r) => won(r.monthly_pay) },
    { key: 'missing', label: '빠진 칸', render: (r) => (r.missing_fields.length ? <Badge v="rejected">{r.missing_fields.join(', ')}</Badge> : '-') },
    { key: 'reported', label: '신고', render: (r) => (r.reported ? <Badge v="completed">완료</Badge> : <Badge v="not_submitted">미신고</Badge>) },
  ]
  return (
    <>
      <div className="alert info">파일을 만든 것만으로는 신고 완료가 아닙니다. 공단 신고를 마친 뒤 완료로 표시하세요.</div>
      {[['acquisition', '자격 취득', 'acquisitions'], ['loss', '자격 상실', 'losses']].map(([kind, title, key]) => (
        <Card key={kind} title={`${title} 신고 대상`} actions={<button className="btn sm" onClick={() => mark(kind, t.data[key])} disabled={!t.data?.[key]?.some((r) => !r.reported)}>미신고자 신고 완료 표시</button>}>
          <Table {...t} rows={t.data?.[key]} columns={cols} empty="대상이 없습니다." />
        </Card>
      ))}
    </>
  )
}

function Bulk() {
  const { scope } = useApp()
  const [code, setCode] = useState('FN16-INSARANG')
  const t = useApi(scope.project_code ? `/api/bulk-registration/${code}/targets` : null, { project_code: scope.project_code, work_month: scope.work_month, department_code: scope.department_code })
  if (!scope.project_code) return <div className="alert info">상단에서 사업을 선택하세요.</div>
  const cols = [
    { key: 'name', label: '성명', render: (r) => <><b>{r.name}</b> {r.reparticipation && <Badge v="x">재참여</Badge>}</> },
    { key: 'department_code', label: '부서' },
    { key: 'p', label: '기간', render: (r) => `${r.start_date} ~ ${r.end_date || ''}` },
    { key: 'missing', label: '빠진 필수 항목', render: (r) => (r.missing_fields.length ? <Badge v="rejected">{r.missing_fields.join(', ')}</Badge> : '-') },
    { key: 'manual', label: '수기 입력', render: (r) => r.manual_items.filter((m) => !m.value).map((m) => m.title).join(', ') || '-' },
  ]
  return (
    <>
      <div className="filters" style={{ marginBottom: 12 }}>
        <select className="input sm" value={code} onChange={(e) => setCode(e.target.value)} aria-label="양식">
          <option value="FN16-INSARANG">인사랑</option><option value="FN16-ILMOA">일모아</option>
        </select>
      </div>
      <Card title="신규 등록 대상"><Table {...t} rows={t.data?.new} columns={cols} empty="대상이 없습니다." /></Card>
      <Card title="퇴사 처리 대상"><Table {...t} rows={t.data?.exited} columns={cols} empty="대상이 없습니다." /></Card>
    </>
  )
}
