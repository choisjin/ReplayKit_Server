import { useEffect, useState } from 'react';
import {
  Badge, Button, Card, Col, Descriptions, Empty, Input, List, message, Modal,
  Progress, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  ApiOutlined, CaretRightOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DesktopOutlined, LoadingOutlined, PauseCircleOutlined, PlayCircleOutlined,
  StopOutlined, WarningOutlined, DisconnectOutlined, SyncOutlined,
} from '@ant-design/icons';
import { useMonitorWs } from './useMonitorWs';
import type { ClientInfo, PlaybackProgress } from './types';

const { Text, Title } = Typography;

const activityColors: Record<string, string> = {
  idle: 'default',
  recording: 'orange',
  playing: 'blue',
};

const activityLabels: Record<string, string> = {
  idle: '대기',
  recording: '녹화 중',
  playing: '재생 중',
};

const playbackStatusLabels: Record<string, string> = {
  idle: '대기',
  running: '실행 중',
  paused: '일시정지',
  stopped: '중지됨',
};

function PlaybackCard({ playback }: { playback: PlaybackProgress }) {
  const stepPercent = playback.total_steps > 0
    ? Math.round((playback.current_step / playback.total_steps) * 100)
    : 0;
  const total = playback.passed + playback.failed + playback.warning + playback.error;

  return (
    <div style={{ marginTop: 12 }}>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="시나리오">{playback.scenario_name || '-'}</Descriptions.Item>
        <Descriptions.Item label="상태">
          <Tag color={playback.status === 'running' ? 'processing' : playback.status === 'paused' ? 'warning' : 'default'}>
            {playbackStatusLabels[playback.status] || playback.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="사이클">
          <Text strong>{playback.current_cycle}</Text> / {playback.total_cycles}
        </Descriptions.Item>
        <Descriptions.Item label="스텝">
          <Text strong>{playback.current_step}</Text> / {playback.total_steps}
        </Descriptions.Item>
      </Descriptions>

      <Progress
        percent={stepPercent}
        size="small"
        status={playback.status === 'running' ? 'active' : undefined}
        style={{ marginTop: 8 }}
      />

      {total > 0 && (
        <Row gutter={8} style={{ marginTop: 8 }}>
          <Col span={6}>
            <Statistic
              title="Pass"
              value={playback.passed}
              valueStyle={{ color: '#52c41a', fontSize: 16 }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Fail"
              value={playback.failed}
              valueStyle={{ color: '#ff4d4f', fontSize: 16 }}
              prefix={<CloseCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Warning"
              value={playback.warning}
              valueStyle={{ color: '#faad14', fontSize: 16 }}
              prefix={<WarningOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Error"
              value={playback.error}
              valueStyle={{ color: '#ff4d4f', fontSize: 16 }}
              prefix={<CloseCircleOutlined />}
            />
          </Col>
        </Row>
      )}

      {playback.error_message && (
        <div style={{ marginTop: 8, padding: '4px 8px', background: '#2a1215', border: '1px solid #58181c', borderRadius: 4 }}>
          <Text type="danger" style={{ fontSize: 12 }}>{playback.error_message}</Text>
        </div>
      )}
    </div>
  );
}

function ClientCard({
  client,
  onCommand,
}: {
  client: ClientInfo;
  onCommand: (clientId: string, action: string, options?: Record<string, any>) => void;
}) {
  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);

  const isPlaying = client.activity === 'playing';
  const isPaused = client.playback?.status === 'paused';

  const handlePlay = () => {
    if (!selectedScenario) {
      message.warning('시나리오를 선택하세요');
      return;
    }
    onCommand(client.client_id, 'play', {
      scenario: selectedScenario,
      repeat: repeatCount,
    });
    setPlayModalOpen(false);
    message.info(`${client.name}: ${selectedScenario} 재생 요청`);
  };

  return (
    <>
      <Card
        size="small"
        title={
          <Space>
            <DesktopOutlined />
            <Text strong>{client.name || client.client_id}</Text>
            <Tag color={activityColors[client.activity] || 'default'}>
              {activityLabels[client.activity] || client.activity}
            </Tag>
          </Space>
        }
        extra={
          <Space size={4}>
            {isPlaying ? (
              <>
                {isPaused ? (
                  <Tooltip title="재개">
                    <Button
                      size="small" type="text"
                      icon={<CaretRightOutlined style={{ color: '#52c41a' }} />}
                      onClick={() => onCommand(client.client_id, 'resume')}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip title="일시정지">
                    <Button
                      size="small" type="text"
                      icon={<PauseCircleOutlined style={{ color: '#faad14' }} />}
                      onClick={() => onCommand(client.client_id, 'pause')}
                    />
                  </Tooltip>
                )}
                <Tooltip title="중지">
                  <Button
                    size="small" type="text" danger
                    icon={<StopOutlined />}
                    onClick={() => onCommand(client.client_id, 'stop')}
                  />
                </Tooltip>
              </>
            ) : (
              <Tooltip title="시나리오 재생">
                <Button
                  size="small" type="text"
                  icon={<PlayCircleOutlined style={{ color: '#1890ff' }} />}
                  onClick={() => {
                    onCommand(client.client_id, 'list_scenarios');
                    setPlayModalOpen(true);
                  }}
                />
              </Tooltip>
            )}
          </Space>
        }
        style={{ height: '100%' }}
      >
        {/* 디바이스 목록 */}
        {client.devices.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>디바이스</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {client.devices.map(d => (
                <Tag key={d.device_id} color={d.status === 'connected' ? 'green' : 'red'}>
                  {d.name || d.device_id} ({d.type})
                </Tag>
              ))}
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>디바이스 없음</Text>
        )}

        {/* 재생 진행 상태 */}
        {client.playback && client.activity === 'playing' && (
          <PlaybackCard playback={client.playback} />
        )}

        {/* 버전/연결 시각 */}
        <div style={{ marginTop: 8, fontSize: 11, color: '#888' }}>
          v{client.version} · {new Date(client.connected_at).toLocaleTimeString()}
        </div>
      </Card>

      {/* 원격 재생 모달 */}
      <Modal
        title={`${client.name} — 시나리오 재생`}
        open={playModalOpen}
        onCancel={() => setPlayModalOpen(false)}
        onOk={handlePlay}
        okText="재생"
        cancelText="취소"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text>시나리오 선택</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder="시나리오를 선택하세요"
              value={selectedScenario || undefined}
              onChange={setSelectedScenario}
              options={(client.scenarios || []).map(s => ({ label: s, value: s }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
            />
          </div>
          <div>
            <Text>반복 횟수</Text>
            <Input
              type="number" min={1} max={999}
              value={repeatCount}
              onChange={e => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 120, marginTop: 4 }}
            />
          </div>
        </Space>
      </Modal>
    </>
  );
}


export default function DashboardPage() {
  const { clients, connected, sendCommand } = useMonitorWs();

  const totalDevices = clients.reduce((sum, c) => sum + c.devices.length, 0);
  const playingCount = clients.filter(c => c.activity === 'playing').length;
  const recordingCount = clients.filter(c => c.activity === 'recording').length;

  return (
    <div>
      {/* 상단 요약 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="연결된 클라이언트"
              value={clients.length}
              prefix={connected
                ? <ApiOutlined style={{ color: '#52c41a' }} />
                : <DisconnectOutlined style={{ color: '#ff4d4f' }} />
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="총 디바이스"
              value={totalDevices}
              prefix={<DesktopOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="재생 중"
              value={playingCount}
              prefix={<PlayCircleOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="녹화 중"
              value={recordingCount}
              prefix={<SyncOutlined style={{ color: '#fa8c16' }} spin={recordingCount > 0} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 서버 연결 상태 */}
      {!connected && (
        <Card size="small" style={{ marginBottom: 16, borderColor: '#ff4d4f' }}>
          <Space>
            <DisconnectOutlined style={{ color: '#ff4d4f' }} />
            <Text type="danger">관제 서버에 연결할 수 없습니다. 재연결 시도 중...</Text>
          </Space>
        </Card>
      )}

      {/* 클라이언트 카드 그리드 */}
      {clients.length === 0 ? (
        <Empty
          description="연결된 ReplayKit이 없습니다"
          style={{ marginTop: 80 }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {clients.map(client => (
            <Col key={client.client_id} xs={24} md={12} xl={8}>
              <ClientCard client={client} onCommand={sendCommand} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
