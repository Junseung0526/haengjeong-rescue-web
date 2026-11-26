import { useState } from 'react'
import { Upload } from 'lucide-react'
import { api, form } from '../api'
import { Badge, Card, ErrorBox, Modal, PageHead, REASON, Stat, Table, Tabs, dt, num, useApi, useApp, useModal, won } from '../ui'

export default function Submissions() {
  const { scope, toast } = useApp()
  const [modal, open] = useModal()
  const [sel, setSel] = useState(null)
  const list = useApi('/api/submissions', { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month })

  const upload = () => open({
    title: '표준 양식 업로드',
    intro: '표준 양식의 열 구조 그대로 채워 올립니다. 업로드하면 임시저장되고, 내용을 확인한 뒤 제출합니다.',
    initial: { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month },
    fields: [
      { name: 'project_code', label: '사업코드', required: true },
      { name: 'department_code', label: '부서코드', required: true },
      { name: 'work_month', label: '업무월', type: 'month', required: true },
      { name: 'file', label: '엑셀 파일', type: 'file', accept: '.xlsx,.xls', required: true, full: true },
    ],
    submitLabel: '업로드',
    onSubmit: async (v) => {
      const r = await api.post('/api/submissions/draft/upload', form(v))
      list.reload()
      setSel(r.submission_id)
      return `v${r.version.version} 임시저장 완료 · 차단 오류 ${r.blocking_issues}건`
    },
  })

  return (
    <>
      <PageHead tag="FN-09 · FN-10" title="부서 제출 포털" desc="부서 담당자가 월별 인건비 자료를 제출하고 부서장이 승인·반려합니다.">
        <button className="btn" onClick={() => api.download('/api/submissions/template').catch((e) => toast(e.message, 'error'))}>표준 양식 받기</button>
        <button className="btn primary" onClick={upload}><Upload size={16} />양식 업로드</button>
      </PageHead>
      <Card title="제출 접수 현황">
        <Table
          {...list}
          rows={list.data}
          onRow={(r) => setSel(r.id)}
          empty="접수된 제출이 없습니다."
          emptyHint="표준 양식을 받아 채운 뒤 업로드하세요."
          columns={[
            { key: 'department_code', label: '부서' },
            { key: 'work_month', label: '업무월' },
            { key: 'v', label: '최신 버전', render: (r) => `v${r.latest.version}` },
            { key: 's', label: '상태', render: (r) => <Badge v={r.latest.status} /> },
            { key: 'rows', label: '인원', num: true, render: (r) => num(r.rows) },
            { key: 'open_issues', label: '미해결 오류', num: true, render: (r) => (r.open_issues ? <Badge v="x"><span style={{ color: 'var(--danger)' }}>{r.open_issues}</span></Badge> : 0) },
            { key: 'at', label: '제출 시각', render: (r) => dt(r.latest.submitted_at) },
          ]}
        />
      </Card>
      {sel && <SubmissionDetail id={sel} onClose={() => setSel(null)} onChanged={list.reload} />}
      {modal}
    </>
  )
}

const ROW_COLS = [
  { key: 'name', label: '성명' },
  { key: 'resident_num_masked', label: '주민번호', render: (r) => <span className="mono">{r.resident_num_masked || '-'}</span> },
  { key: 'full_days', label: '만근일', num: true },
  { key: 'claim_total', label: '청구액', num: true, render: (r) => won(r.claim_total) },
  { key: 'deduction_total', label: '공제액', num: true, render: (r) => won(r.deduction_total) },
  { key: 'net_pay', label: '실지급액', num: true, render: (r) => won(r.net_pay) },
  { key: 'acc', label: '계좌', render: (r) => (r.has_bank_account ? '등록' : <Badge v="unmatched">없음</Badge>) },
]

export const ISSUE_COLS = [
  { key: 'title', label: '오류', render: (r) => <><Badge v={r.blocking ? 'rejected' : 'needs_review'}>{r.blocking ? '차단' : '확인'}</Badge> {r.title}</> },
  { key: 'person_name', label: '대상자' },
  { key: 'field_label', label: '항목' },
  { key: 'actual_val', label: '입력값' },
  { key: 'expected_val', label: '기준값' },
  { key: 'src', label: '원본 위치', render: (r) => (r.source.row_index ? `${r.source.sheet_name || ''} ${r.source.row_index}행` : '-') },
  { key: 'res', label: '상태', render: (r) => (r.is_resolved ? <Badge v="completed">해결</Badge> : <Badge v="needs_review">미해결</Badge>) },
]

function SubmissionDetail({ id, onClose, onChanged }) {
  const { user } = useApp()
  const [modal, open] = useModal()
  const [tab, setTab] = useState('rows')
  const [ver, setVer] = useState(null)
  const [error, setError] = useState(null)
  const sub = useApi(`/api/submissions/${id}`)
  const versions = sub.data?.versions || []
  const v = ver ?? versions.at(-1)?.version
  const detail = useApi(v ? `/api/submissions/${id}/versions/${v}` : null)
  const docs = useApi(tab === 'sign' && detail.data ? `/api/signatures/versions/${detail.data.version.id}/documents` : null)
  const d = detail.data
  const latest = v === versions.at(-1)?.version
  const status = d?.version.status
  const canApprove = ['department_head', 'system_admin'].includes(user.role)
  const refresh = () => { sub.reload(); detail.reload(); onChanged() }

  const act = async (fn) => {
    setError(null)
    try { await fn(); refresh() } catch (e) { setError(e) }
  }

  const approve = () => open({
    title: '승인',
    intro: '승인하면 제출이 확정되고 이 버전은 잠깁니다.',
    fields: [{ name: 'official_doc_no', label: '공문 번호 (선택)' }],
    submitLabel: '승인',
    onSubmit: async (x) => { await api.post(`/api/submissions/${id}/approve`, { official_doc_no: x.official_doc_no || null }); refresh(); return '승인했습니다.' },
  })
  const reject = () => open({
    title: '반려', danger: true, fields: [{ ...REASON, hint: '부서 담당자에게 전달됩니다.' }], submitLabel: '반려',
    onSubmit: async (x) => { await api.post(`/api/submissions/${id}/reject`, x); refresh(); return '반려했습니다.' },
  })
  const attach = () => open({
    title: '공문 첨부', fields: [{ name: 'file', label: '파일 (pdf·hwp·hwpx·jpg·png)', type: 'file', required: true, accept: '.pdf,.hwp,.hwpx,.jpg,.jpeg,.png' }], submitLabel: '첨부',
    onSubmit: async (x) => { await api.post(`/api/submissions/${id}/official-docs`, form(x)); refresh() },
  })
  const claimScan = () => open({
    title: '서명 청구서 스캔 업로드',
    intro: '서명을 모두 받은 부서 청구서 스캔본과 문서 아래의 확인 코드를 입력합니다.',
    fields: [{ name: 'content_code', label: '확인 코드', required: true }, { name: 'file', label: '스캔 파일', type: 'file', required: true, accept: '.pdf,.jpg,.jpeg,.png' }],
    submitLabel: '업로드',
    onSubmit: async (x) => { await api.post(`/api/signatures/versions/${d.version.id}/payment_claim/scan`, form(x)); docs.reload() },
  })

  return (
    <Modal wide title={sub.data ? `${sub.data.department_code} · ${sub.data.work_month} 제출` : '제출'} onClose={onClose}
      footer={d && latest && <>
        {status === 'draft' && <button className="btn" onClick={attach}>공문 첨부</button>}
        {status === 'draft' && <button className="btn primary" disabled={d.blocking_issues > 0} title={d.blocking_issues ? '차단 오류를 먼저 해결하세요' : ''}
          onClick={() => act(() => api.post(`/api/submissions/${id}/submit`))}>제출</button>}
        {status === 'submitted' && canApprove && <><button className="btn danger" onClick={reject}>반려</button><button className="btn primary" onClick={approve}>승인</button></>}
      </>}>
      <ErrorBox error={error || sub.error || detail.error} />
      <div className="filters" style={{ marginBottom: 16 }}>
        <select className="input sm" value={v || ''} onChange={(e) => setVer(Number(e.target.value))} aria-label="버전">
          {versions.map((x) => <option key={x.version} value={x.version}>v{x.version} · {x.status}</option>)}
        </select>
        {d && <Badge v={status} />}
        {d?.version.locked && <Badge v="x">잠김</Badge>}
        {d?.approval?.reason && <span className="muted">반려 사유: {d.approval.reason}</span>}
      </div>
      {d && (
        <>
          {d.blocking_issues > 0 && <div className="alert warn">차단 오류 {d.blocking_issues}건이 남아 있어 제출할 수 없습니다. 양식을 고쳐 다시 업로드하거나 검증 오류 화면에서 수정하세요.</div>}
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <Stat label="인원" value={num(d.totals.count)} unit="명" />
            <Stat label="청구 합계" value={num(d.totals.claim_total)} unit="원" />
            <Stat label="공제 합계" value={num(d.totals.deduction_total)} unit="원" />
            <Stat label="실지급 합계" value={num(d.totals.net_pay)} unit="원" />
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[['rows', `참여자 ${d.rows.length}`], ['issues', `오류 ${d.issues.length}`], ['docs', `공문 ${d.official_docs.length}`], ['sign', '서명']]} />
          <div className="card">
            {tab === 'rows' && <Table rows={d.rows} columns={ROW_COLS} />}
            {tab === 'issues' && <Table rows={d.issues} columns={ISSUE_COLS} empty="오류가 없습니다." />}
            {tab === 'docs' && <Table rows={d.official_docs} empty="첨부한 공문이 없습니다." columns={[
              { key: 'original_filename', label: '파일' }, { key: 'created_at', label: '첨부 시각', render: (r) => dt(r.created_at) },
              { key: 'a', label: '', render: (r) => <button className="btn sm" onClick={() => api.download(`/api/submissions/${id}/official-docs/${r.id}`)}>받기</button> },
            ]} />}
            {tab === 'sign' && (
              <>
                <div className="card-head"><span className="muted">확인서·청구서 서명 상태</span>
                  <div className="actions">
                    <button className="btn sm" onClick={() => api.download(`/api/signatures/versions/${d.version.id}/payment_claim/pdf`)}>부서 청구서 PDF</button>
                    <button className="btn sm primary" onClick={claimScan}>서명본 업로드</button>
                  </div>
                </div>
                <Table {...docs} rows={docs.data} columns={[
                  { key: 'name', label: '성명' },
                  { key: 'doc_type', label: '문서', render: (r) => (r.doc_type === 'payment_claim' ? '청구서' : '근무확인서') },
                  { key: 'status', label: '상태', render: (r) => <Badge v={r.status} /> },
                  { key: 'doc_version', label: '문서 버전' },
                  { key: 'a', label: '', render: (r) => <button className="btn sm" onClick={() => api.download(`/api/signatures/versions/${d.version.id}/rows/${r.row_id}/${r.doc_type}/pdf`)}>PDF</button> },
                ]} />
              </>
            )}
          </div>
        </>
      )}
      {modal}
    </Modal>
  )
}
