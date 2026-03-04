/**
 * ConfigEditor component for MongoDB datasource settings.
 *
 * Renders the datasource configuration form with connection URI,
 * authentication, and TLS settings.
 */
import { ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { InlineField, Input, SecretInput, InlineSwitch, Combobox, ComboboxOption, TextArea, FieldSet, Button } from '@grafana/ui';

import { MongoDBDataSourceOptions, MongoDBSecureJsonData, AuthMechanism } from '../../types';

/** Props for the ConfigEditor component. */
type ConfigEditorProps = DataSourcePluginOptionsEditorProps<MongoDBDataSourceOptions, MongoDBSecureJsonData>;

const AUTH_MECHANISMS: Array<ComboboxOption<AuthMechanism>> = [
  { label: 'None', value: '' },
  { label: 'SCRAM-SHA-256', value: 'SCRAM-SHA-256' },
  { label: 'SCRAM-SHA-1', value: 'SCRAM-SHA-1' },
  { label: 'X.509', value: 'MONGODB-X509' },
];

const LABEL_WIDTH = 20;

/**
 * ConfigEditor renders the datasource settings form.
 *
 * @description Provides fields for MongoDB connection configuration including
 * URI, authentication mechanism, credentials, TLS, and Atlas SRV toggle.
 */
export function ConfigEditor(props: ConfigEditorProps) {
  const { onOptionsChange, options } = props;
  const { jsonData, secureJsonFields, secureJsonData } = options;

  const onURIChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        uri: event.target.value,
      },
    });
  };

  const onURIReset = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        uri: false,
      },
      secureJsonData: {
        ...secureJsonData,
        uri: '',
      },
    });
  };

  const onDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        database: event.target.value,
      },
    });
  };

  const onAuthMechanismChange = (option: ComboboxOption<AuthMechanism>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        authMechanism: option.value,
      },
    });
  };

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        password: event.target.value,
      },
    });
  };

  const onPasswordReset = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        password: false,
      },
      secureJsonData: {
        ...secureJsonData,
        password: '',
      },
    });
  };

  const onTLSToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        tlsEnabled: event.currentTarget.checked,
      },
    });
  };

  const onSRVToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        isSrv: event.currentTarget.checked,
      },
    });
  };

  const onUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        username: event.target.value,
      },
    });
  };

  const onClientCertChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        tlsClientCert: event.target.value,
      },
    });
  };

  const onClientCertReset = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        tlsClientCert: false,
      },
      secureJsonData: {
        ...secureJsonData,
        tlsClientCert: '',
      },
    });
  };

  const onClientKeyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...secureJsonData,
        tlsClientKey: event.target.value,
      },
    });
  };

  const onClientKeyReset = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...secureJsonFields,
        tlsClientKey: false,
      },
      secureJsonData: {
        ...secureJsonData,
        tlsClientKey: '',
      },
    });
  };

  const onCACertChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        tlsCaCert: event.target.value,
      },
    });
  };

  return (
    <>
      <FieldSet label="Connection">
        <InlineField label="Connection URI" labelWidth={LABEL_WIDTH} tooltip="MongoDB connection string (e.g., mongodb://host:port/database)">
          <SecretInput
            isConfigured={secureJsonFields?.uri ?? false}
            value={secureJsonData?.uri ?? ''}
            placeholder="mongodb://localhost:27017"
            width={60}
            onReset={onURIReset}
            onChange={onURIChange}
          />
        </InlineField>

        <InlineField label="Default Database" labelWidth={LABEL_WIDTH} tooltip="Default database to use for queries">
          <Input
            value={jsonData.database ?? ''}
            placeholder="mydb"
            width={40}
            onChange={onDatabaseChange}
          />
        </InlineField>

        <InlineField label="Atlas (SRV)" labelWidth={LABEL_WIDTH} tooltip="Enable MongoDB+SRV protocol for Atlas connections">
          <InlineSwitch
            value={jsonData.isSrv ?? false}
            onChange={onSRVToggle}
          />
        </InlineField>
      </FieldSet>

      <FieldSet label="Authentication">
        <InlineField label="Auth Mechanism" labelWidth={LABEL_WIDTH} tooltip="MongoDB authentication mechanism">
          <Combobox
            options={AUTH_MECHANISMS}
            value={jsonData.authMechanism ?? ''}
            onChange={onAuthMechanismChange}
            width={40}
          />
        </InlineField>

        {jsonData.authMechanism && jsonData.authMechanism !== 'MONGODB-X509' && (
          <>
            <InlineField label="Username" labelWidth={LABEL_WIDTH} tooltip="MongoDB username">
              <Input
                value={jsonData.username ?? ''}
                placeholder="username"
                width={40}
                onChange={onUsernameChange}
              />
            </InlineField>

            <InlineField label="Password" labelWidth={LABEL_WIDTH} tooltip="MongoDB password">
              <SecretInput
                isConfigured={secureJsonFields?.password ?? false}
                value={secureJsonData?.password ?? ''}
                placeholder="password"
                width={40}
                onReset={onPasswordReset}
                onChange={onPasswordChange}
              />
            </InlineField>
          </>
        )}

        {jsonData.authMechanism === 'MONGODB-X509' && (
          <>
            <InlineField label="Client Certificate" labelWidth={LABEL_WIDTH} tooltip="PEM-encoded client certificate for X.509 auth">
              {secureJsonFields?.tlsClientCert ? (
                <Button variant="secondary" onClick={onClientCertReset}>Reset</Button>
              ) : (
                <TextArea
                  value={secureJsonData?.tlsClientCert ?? ''}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  rows={5}
                  cols={60}
                  onChange={onClientCertChange}
                />
              )}
            </InlineField>

            <InlineField label="Client Key" labelWidth={LABEL_WIDTH} tooltip="PEM-encoded client private key for X.509 auth">
              {secureJsonFields?.tlsClientKey ? (
                <Button variant="secondary" onClick={onClientKeyReset}>Reset</Button>
              ) : (
                <TextArea
                  value={secureJsonData?.tlsClientKey ?? ''}
                  placeholder="-----BEGIN EC PRIVATE KEY-----"
                  rows={5}
                  cols={60}
                  onChange={onClientKeyChange}
                />
              )}
            </InlineField>
          </>
        )}
      </FieldSet>

      <FieldSet label="TLS / SSL">
        <InlineField label="TLS Enabled" labelWidth={LABEL_WIDTH} tooltip="Enable TLS for the MongoDB connection">
          <InlineSwitch
            value={jsonData.tlsEnabled ?? false}
            onChange={onTLSToggle}
          />
        </InlineField>

        {jsonData.tlsEnabled && (
          <InlineField label="CA Certificate" labelWidth={LABEL_WIDTH} tooltip="PEM-encoded CA certificate">
            <TextArea
              value={jsonData.tlsCaCert ?? ''}
              placeholder="-----BEGIN CERTIFICATE-----"
              rows={5}
              cols={60}
              onChange={onCACertChange}
            />
          </InlineField>
        )}
      </FieldSet>
    </>
  );
}
