import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigEditor } from './ConfigEditor';

const defaultProps = {
  options: {
    id: 1,
    uid: 'test-uid',
    orgId: 1,
    name: 'MongoDB',
    type: 'milosmiric-mongodb-datasource',
    typeName: 'MongoDB',
    typeLogoUrl: '',
    access: 'proxy' as const,
    url: '',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthUser: '',
    isDefault: false,
    readOnly: false,
    withCredentials: false,
    jsonData: {},
    secureJsonFields: {},
    secureJsonData: {},
    version: 1,
    apiVersion: '',
  },
  onOptionsChange: jest.fn(),
};

describe('ConfigEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders connection fields', () => {
    render(<ConfigEditor {...defaultProps} />);
    expect(screen.getByText('Connection URI')).toBeInTheDocument();
    expect(screen.getByText('Default Database')).toBeInTheDocument();
    expect(screen.getByText('Atlas (SRV)')).toBeInTheDocument();
  });

  it('renders authentication fields', () => {
    render(<ConfigEditor {...defaultProps} />);
    expect(screen.getByText('Auth Mechanism')).toBeInTheDocument();
  });

  it('renders TLS fields', () => {
    render(<ConfigEditor {...defaultProps} />);
    expect(screen.getByText('TLS Enabled')).toBeInTheDocument();
  });

  it('calls onOptionsChange when database changes', async () => {
    const user = userEvent.setup();
    render(<ConfigEditor {...defaultProps} />);

    const dbInput = screen.getByPlaceholderText('mydb');
    await user.type(dbInput, 'x');

    expect(defaultProps.onOptionsChange).toHaveBeenCalled();
    const lastCall = defaultProps.onOptionsChange.mock.calls[defaultProps.onOptionsChange.mock.calls.length - 1][0];
    expect(lastCall.jsonData.database).toBe('x');
  });

  it('shows CA cert field when TLS is enabled', () => {
    const propsWithTLS = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { tlsEnabled: true },
      },
    };

    render(<ConfigEditor {...propsWithTLS} />);
    expect(screen.getByText('CA Certificate')).toBeInTheDocument();
  });

  it('hides CA cert field when TLS is disabled', () => {
    render(<ConfigEditor {...defaultProps} />);
    expect(screen.queryByText('CA Certificate')).not.toBeInTheDocument();
  });

  it('shows password field for SCRAM auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'SCRAM-SHA-256' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('shows password field for SCRAM-SHA-1 auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'SCRAM-SHA-1' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('hides password field when auth mechanism is None (empty string)', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: '' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.queryByText('Password')).not.toBeInTheDocument();
  });

  it('hides password field when auth mechanism is not set', () => {
    render(<ConfigEditor {...defaultProps} />);
    expect(screen.queryByText('Password')).not.toBeInTheDocument();
  });

  it('hides password field for X509 auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'MONGODB-X509' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.queryByText('Password')).not.toBeInTheDocument();
  });

  it('shows username field for SCRAM-SHA-256 auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'SCRAM-SHA-256' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('hides username field for X509 auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'MONGODB-X509' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.queryByText('Username')).not.toBeInTheDocument();
  });

  it('shows client cert fields for X509 auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'MONGODB-X509' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.getByText('Client Certificate')).toBeInTheDocument();
    expect(screen.getByText('Client Key')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('-----BEGIN CERTIFICATE-----')).toBeInTheDocument();
  });

  it('shows reset button for configured client cert', () => {
    const propsWithConfigured = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'MONGODB-X509' as const },
        secureJsonFields: { tlsClientCert: true, tlsClientKey: true },
      },
    };

    render(<ConfigEditor {...propsWithConfigured} />);
    const resetButtons = screen.getAllByText('Reset');
    expect(resetButtons.length).toBe(2);
  });

  it('hides client cert fields for SCRAM auth', () => {
    const propsWithAuth = {
      ...defaultProps,
      options: {
        ...defaultProps.options,
        jsonData: { authMechanism: 'SCRAM-SHA-256' as const },
      },
    };

    render(<ConfigEditor {...propsWithAuth} />);
    expect(screen.queryByText('Client Certificate')).not.toBeInTheDocument();
    expect(screen.queryByText('Client Key')).not.toBeInTheDocument();
  });
});
