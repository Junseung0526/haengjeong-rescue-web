import { useState } from 'react'
import { Upload } from 'lucide-react'
import { api, form } from '../api'
import { Badge, Card, INSURANCE, PageHead, REASON, Stat, Table, Tabs, date, num, useApi, useApp, useDeptNames, projName, useModal, won, useUrlState } from '../ui'

const COUNT_LABEL = { confirmed: '해당 사업 확정', needs_review: '확인 필요', other_project: '타 사업', not_target: '명단 외', unidentified: '판단 불가', zero_rows: '0원 행' }

export default function Insurance() {
  const { scope } = useApp()
  const depts = useDeptNames()
  const [modal, open] = useModal()
  const [tab, setTab] = useUrlState('tab', 'records')
  const [status, setStatus] = useUrlState('status')
  const [upload, setUpload] = useState(null)
  const q = { project_code: scope.project_code, charge_month: scope.work_month }
  const on = !!scope.project_code
  const sum = useApi(on ? '/api/insurance/summary' : null, q)
  const recs = useApi(on ? '/api/insurance/records' : null, { ...q, reconcile_status: status })
  const wps = useApi(tab === 'workplaces' ? '/api/insurance/workplaces' : null)
  const total = (s) => sum.data?.totals.find((t) => t.reconcile_status === s)
  const reload = () => { sum.reload(); recs.reload() }

  const uploadNotice = () => open({
    title: '공단 고지 엑셀 업로드',
    intro: '국민연금·건강/요양·고용·산재 고지 파일(xlsx·xls)을 읽어 행마다 귀속을 판정합니다. 같은 파일은 다시 반영하지 않습니다.',
    initial: { charge_month: scope.work_month },
    fields: [
      { name: 'file', label: '고지 파일', type: 'file', required: true, accept: '.xlsx,.xls' },
      { name: 'charge_month', label: '부과월', type: 'month', hint: '고용·산재 고지는 필수' },
      { name: 'workplace_code', label: '사업장관리번호', hint: '고용·산재 고지는 필수, 숫자만' },
    ],
    submitLabel: '업로드',
    onSubmit: async (v) => { const r = await api.post('/api/insurance/notices', form(v)); setUpload(r); reload(); return r.duplicate ? '이미 반영된 파일입니다.' : `${r.rows}행을 읽었습니다.` },
  })

  const confirm = (r) => open({
    title: `${r.person_name} ${INSURANCE[r.insurance_type]} 귀속 확정`,
    intro: '귀속월 급여가 있어야 하며 납부·환급 업무가 함께 생깁니다.',
    initial: { participation_id: r.candidates[0]?.participation_id },
    fields: [
      { name: 'participation_id', label: '후보 참여', type: 'select', required: true, options: r.candidates.map((c) => [c.participation_id, `${c.project_code} · ${date(c.start_date)}~${c.end_date ? date(c.end_date) : ''}`]) },
      { name: 'attribution_month', label: '귀속월', type: 'month', hint: `귀속기간 ${r.attribution_period}이 여러 달이거나 미상일 때` },
      REASON,
    ],
    submitLabel: '확정',
    onSubmit: async (v) => { await api.post(`/api/insurance/records/${r.id}/confirm`, { ...v, attribution_month: v.attribution_month || null }); reload() },
  })
  const other = (r) => open({
    title: '타 사업분으로 분리', fields: [REASON], submitLabel: '분리',
    onSubmit: async (v) => { await api.post(`/api/insurance/records/${r.id}/other-project`, v); reload() },
  })
  const setWp = (w) => open({
    title: '사업장 연결', initial: w ? { ...w, project_codes: w.project_codes.join(', ') } : { agency_group: 'nhis_nps' },
    intro: '목록에서 빠진 사업은 연결이 풀립니다.',
    fields: [
      { name: 'workplace_code', label: '사업장관리번호', required: true, hint: '숫자 8~20자리' },
      { name: 'agency_group', label: '공단', type: 'select', required: true, options: [['nhis_nps', '건강·요양·국민연금'], ['comwel', '고용·산재']] },
      { name: 'project_codes', label: '사업코드', required: true, hint: '쉼표로 구분' },
    ],
    onSubmit: async (v) => { await api.put('/api/insurance/workplaces', { ...v, project_codes: v.project_codes.split(',').map((s) => s.trim()).filter(Boolean) }); wps.reload() },
  })

  return (
    <>
      <PageHead tag="FN-04" title="4대보험 귀속 매칭" desc="공단 고지를 사업·귀속월에 맞춰 확정하고 급여와 연결합니다.">
        <button className="btn primary" onClick={uploadNotice}><Upload size={16} />고지 파일 업로드</button>
      </PageHead>
      {!on && <div className="alert info">상단에서 사업을 선택하세요. 부과월은 업무월을 따릅니다.</div>}
      {upload && (
        <Card title={`업로드 결과 · ${upload.filename}`} actions={<button className="btn ghost sm" onClick={() => setUpload(null)}>닫기</button>} pad>
          <dl className="dl">
            {Object.entries(upload.counts).flatMap(([k, n]) => [<dt key={k}>{COUNT_LABEL[k]}</dt>, <dd key={k + 'v'}>{n}건</dd>])}
          </dl>
          {upload.problems?.length > 0 && <div className="alert warn" style={{ marginTop: 12 }}>읽지 못한 행 {upload.problems.length}건: {upload.problems.slice(0, 5).map((p) => JSON.stringify(p)).join(' / ')}</div>}
        </Card>
      )}
      {on && (
        <div className="grid grid-4" style={{ margin: '16px 0' }}>
          <Stat label="해당 사업 확정" value={num(total('confirmed')?.count)} unit="건" hint={total('confirmed') && `근로자 ${won(total('confirmed').worker_share)}`} />
          <Stat label="확인 필요" value={num(total('needs_review')?.count)} unit="건" attn={total('needs_review')?.count > 0} />
          <Stat label="타 사업" value={num(total('other_project')?.count)} unit="건" />
          <Stat label="확정 환급" value={num(sum.data?.confirmed_refund_amount)} unit="원" hint={`${num(sum.data?.confirmed_refund_count)}건`} />
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[['records', '고지 내역'], ['workplaces', '사업장 연결']]} />
      {tab === 'records' && on && (
        <Card title="고지 내역" actions={
          <select className="input sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="분류">
            <option value="">전체</option><option value="needs_review">확인 필요</option><option value="confirmed">확정</option><option value="other_project">타 사업</option>
          </select>}>
          <Table {...recs} rows={recs.data} empty="고지 내역이 없습니다." columns={[
            { key: 'person_name', label: '성명', render: (r) => <><b>{r.person_name}</b> <span className="mono">{r.resident_num_masked}</span></> },
            { key: 'insurance_type', label: '보험', render: (r) => INSURANCE[r.insurance_type] },
            { key: 'attribution_period', label: '귀속기간' },
            { key: 'worker_share', label: '근로자', num: true, render: (r) => (r.is_refund ? '-' : '') + won(r.worker_share) },
            { key: 'employer_share', label: '사용자', num: true, render: (r) => (r.is_refund ? '-' : '') + won(r.employer_share) },
            { key: 'reconcile_status', label: '분류', render: (r) => <Badge v={r.reconcile_status} /> },
            { key: 'review_reason', label: '사유', render: (r) => <span className="muted">{r.review_reason || r.deferred_work_item?.reason || ''}</span> },
            { key: 'a', label: '', render: (r) => r.reconcile_status === 'needs_review' && (
              <div className="actions">
                <button className="btn sm primary" disabled={!r.candidates?.length} onClick={() => confirm(r)}>확정</button>
                <button className="btn sm" onClick={() => other(r)}>타 사업</button>
              </div>) },
          ]} />
        </Card>
      )}
      {tab === 'workplaces' && (
        <Card title="사업장관리번호별 사업" actions={<button className="btn sm primary" onClick={() => setWp(null)}>사업장 연결</button>}>
          <Table {...wps} rows={wps.data} onRow={setWp} empty="연결된 사업장이 없습니다." columns={[
            { key: 'workplace_code', label: '사업장관리번호', render: (r) => <span className="mono">{r.workplace_code}</span> },
            { key: 'agency_group', label: '공단', render: (r) => (r.agency_group === 'comwel' ? '근로복지공단(고용·산재)' : '건강보험·국민연금') },
            { key: 'project_codes', label: '사업', render: (r) => r.project_codes.map((c) => projName(depts, c)).join(', ') },
          ]} />
        </Card>
      )}
      {modal}
    </>
  )
}
