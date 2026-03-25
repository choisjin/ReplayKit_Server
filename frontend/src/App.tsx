import { App as AntdApp, ConfigProvider, Layout, theme, Typography } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import DashboardPage from './DashboardPage';

const { Header, Content } = Layout;
const { Title } = Typography;

function AppContent() {
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 24px', height: 48, lineHeight: '48px',
        }}>
          <DashboardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0, color: '#fff' }}>
            ReplayKit Monitor
          </Title>
        </Header>
        <Content style={{ padding: 16 }}>
          <DashboardPage />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <AntdApp>
      <AppContent />
    </AntdApp>
  );
}
