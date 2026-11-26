import { useState } from 'react'
import { api } from '../api'
import { Bell } from 'lucide-react'
import { Card, Empty, PageHead, dt, useApi } from '../ui'

export default function Notifications() {
  const [unread, setUnread] = useState(true)
  const list = useApi('/api/notifications', { unread_only: unread, limit: 100 })
  const read = async (n) => { await api.patch(`/api/notifications/${n.id}/read`); list.reload() }
  return (
    <>
      <PageHead tag="FN-15" title="알림" desc="마감·독촉, 반려, 업무 알림입니다.">
        <label className="check"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />안 읽은 알림만</label>
      </PageHead>
      <Card title="알림" count={list.data?.total}>
        {list.data?.items?.length ? (
          <div className="list">
            {list.data.items.map((n) => (
              <div key={n.id} style={{ opacity: n.read_at ? 0.6 : 1 }}>
                <span>{!n.read_at && <b style={{ color: 'var(--primary)' }}>● </b>}{n.message}</span>
                <span className="actions">
                  <span className="muted" style={{ fontSize: 13 }}>{dt(n.created_at)}</span>
                  {!n.read_at && <button className="btn sm" onClick={() => read(n)}>읽음</button>}
                </span>
              </div>
            ))}
          </div>
        ) : list.loading ? <div className="card-body"><div className="skel" style={{ width: '60%' }} /></div>
          : <Empty icon={Bell} title={unread ? '안 읽은 알림이 없습니다.' : '알림이 없습니다.'} hint="마감 독촉, 반려, 업무 알림이 오면 여기에 쌓입니다." />}
      </Card>
    </>
  )
}
