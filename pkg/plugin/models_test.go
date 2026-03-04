package plugin

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseQueryModel(t *testing.T) {
	tests := []struct {
		name      string
		json      string
		wantErr   error
		wantModel QueryModel
	}{
		{
			name: "valid query with all fields",
			json: `{"database":"testdb","collection":"testcoll","pipeline":"[{\"$limit\":10}]","timeField":"timestamp","format":"time_series","legendFormat":"{{name}}"}`,
			wantModel: QueryModel{
				Database:     "testdb",
				Collection:   "testcoll",
				Pipeline:     `[{"$limit":10}]`,
				TimeField:    "timestamp",
				Format:       QueryFormatTimeSeries,
				LegendFormat: "{{name}}",
			},
		},
		{
			name: "defaults format to table when empty",
			json: `{"database":"testdb","collection":"testcoll","pipeline":"[]"}`,
			wantModel: QueryModel{
				Database:   "testdb",
				Collection: "testcoll",
				Pipeline:   "[]",
				Format:     QueryFormatTable,
			},
		},
		{
			name:    "missing database returns error",
			json:    `{"collection":"testcoll","pipeline":"[]"}`,
			wantErr: ErrMissingDatabase,
		},
		{
			name:    "missing collection returns error",
			json:    `{"database":"testdb","pipeline":"[]"}`,
			wantErr: ErrMissingCollection,
		},
		{
			name:    "invalid JSON returns error",
			json:    `{invalid}`,
			wantErr: nil, // json.Unmarshal error, not our sentinel
		},
		{
			name: "empty database string returns error",
			json: `{"database":"","collection":"testcoll","pipeline":"[]"}`,
			wantErr: ErrMissingDatabase,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := backend.DataQuery{
				JSON: json.RawMessage(tt.json),
			}

			model, err := ParseQueryModel(query)
			if tt.wantErr != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			if tt.name == "invalid JSON returns error" {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantModel, model)
		})
	}
}

func TestParseDatasourceSettings(t *testing.T) {
	tests := []struct {
		name         string
		jsonData     string
		secureData   map[string]string
		wantErr      error
		wantSettings DatasourceSettings
	}{
		{
			name:     "valid settings with URI in JSON",
			jsonData: `{"uri":"mongodb://localhost:27105","database":"demo","isSrv":false,"tlsEnabled":false}`,
			wantSettings: DatasourceSettings{
				URI:      "mongodb://localhost:27105",
				Database: "demo",
			},
		},
		{
			name:       "URI from secure JSON data",
			jsonData:   `{"database":"demo"}`,
			secureData: map[string]string{"uri": "mongodb://user:pass@host:27105"},
			wantSettings: DatasourceSettings{
				URI:      "mongodb://user:pass@host:27105",
				Database: "demo",
			},
		},
		{
			name:     "missing URI returns error",
			jsonData: `{"database":"demo"}`,
			wantErr:  ErrMissingConnectionURI,
		},
		{
			name:     "invalid JSON returns error",
			jsonData: `{invalid}`,
		},
		{
			name:       "password extracted from secure data",
			jsonData:   `{"uri":"mongodb://localhost:27105","database":"demo"}`,
			secureData: map[string]string{"password": "secret123"},
			wantSettings: DatasourceSettings{
				URI:      "mongodb://localhost:27105",
				Database: "demo",
				Password: "secret123",
			},
		},
		{
			name:     "empty password when not provided",
			jsonData: `{"uri":"mongodb://localhost:27105","database":"demo"}`,
			wantSettings: DatasourceSettings{
				URI:      "mongodb://localhost:27105",
				Database: "demo",
			},
		},
		{
			name:     "SRV and TLS settings",
			jsonData: `{"uri":"mongodb+srv://cluster.example.com","isSrv":true,"tlsEnabled":true,"tlsCaCert":"-----BEGIN CERTIFICATE-----","authMechanism":"SCRAM-SHA-256"}`,
			wantSettings: DatasourceSettings{
				URI:           "mongodb+srv://cluster.example.com",
				IsSRV:         true,
				TLSEnabled:    true,
				TLSCACert:     "-----BEGIN CERTIFICATE-----",
				AuthMechanism: "SCRAM-SHA-256",
			},
		},
		{
			name:       "client cert extracted from secure data",
			jsonData:   `{"uri":"mongodb://localhost:27105","database":"demo"}`,
			secureData: map[string]string{"tlsClientCert": "-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----"},
			wantSettings: DatasourceSettings{
				URI:           "mongodb://localhost:27105",
				Database:      "demo",
				TLSClientCert: "-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----",
			},
		},
		{
			name:       "client key extracted from secure data",
			jsonData:   `{"uri":"mongodb://localhost:27105","database":"demo"}`,
			secureData: map[string]string{"tlsClientKey": "-----BEGIN EC PRIVATE KEY-----\nkey\n-----END EC PRIVATE KEY-----"},
			wantSettings: DatasourceSettings{
				URI:          "mongodb://localhost:27105",
				Database:     "demo",
				TLSClientKey: "-----BEGIN EC PRIVATE KEY-----\nkey\n-----END EC PRIVATE KEY-----",
			},
		},
		{
			name:     "username from JSON data",
			jsonData: `{"uri":"mongodb://localhost:27105","database":"demo","username":"myuser","authMechanism":"SCRAM-SHA-256"}`,
			wantSettings: DatasourceSettings{
				URI:           "mongodb://localhost:27105",
				Database:      "demo",
				Username:      "myuser",
				AuthMechanism: "SCRAM-SHA-256",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			secureData := tt.secureData
			if secureData == nil {
				secureData = map[string]string{}
			}

			settings := backend.DataSourceInstanceSettings{
				JSONData:                json.RawMessage(tt.jsonData),
				DecryptedSecureJSONData: secureData,
			}

			dsSettings, err := ParseDatasourceSettings(settings)
			if tt.wantErr != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			if tt.name == "invalid JSON returns error" {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantSettings, dsSettings)
		})
	}
}
