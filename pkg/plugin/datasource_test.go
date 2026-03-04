package plugin

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func TestCheckHealth_Success(t *testing.T) {
	client := &mockMongoClient{
		serverVersion: "8.0.1",
		replicaSet:    "rs0",
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusOk, result.Status)
	assert.Contains(t, result.Message, "MongoDB connected")
	assert.Contains(t, result.Message, "8.0.1")
	assert.Contains(t, result.Message, "rs0")
}

func TestCheckHealth_NilClient(t *testing.T) {
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, nil)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, result.Status)
	assert.Contains(t, result.Message, "not initialized")
}

func TestCheckHealth_PingFails(t *testing.T) {
	client := &mockMongoClient{
		pingErr: errors.New("connection refused"),
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusError, result.Status)
	assert.Contains(t, result.Message, "ping")
}

func TestCheckHealth_NoReplicaSet(t *testing.T) {
	client := &mockMongoClient{
		serverVersion: "8.0.0",
		replicaSet:    "",
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	require.NoError(t, err)
	assert.Equal(t, backend.HealthStatusOk, result.Status)
	assert.NotContains(t, result.Message, "Replica set")
}

func TestDispose(t *testing.T) {
	client := &mockMongoClient{}
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	// Should not panic.
	ds.Dispose()
}

func TestDispose_NilClient(t *testing.T) {
	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, nil)

	// Should not panic with nil client.
	ds.Dispose()
}

// generateTestCACert creates a self-signed PEM certificate for testing.
func generateTestCACert(t *testing.T) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "Test CA"},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour),
		IsCA:         true,
		KeyUsage:     x509.KeyUsageCertSign,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	require.NoError(t, err)

	return string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER}))
}

// generateTestClientCert creates a client cert+key signed by the given CA for testing.
func generateTestClientCert(t *testing.T, caCertPEM string) (certPEM, keyPEM string) {
	t.Helper()

	// Parse the CA cert.
	block, _ := pem.Decode([]byte(caCertPEM))
	require.NotNil(t, block)
	caCert, err := x509.ParseCertificate(block.Bytes)
	require.NoError(t, err)

	// We need the CA key — generate a fresh CA for this helper.
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	caTemplate := x509.Certificate{
		SerialNumber: big.NewInt(100),
		Subject:      pkix.Name{CommonName: "Test CA"},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour),
		IsCA:         true,
		KeyUsage:     x509.KeyUsageCertSign,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, &caTemplate, &caTemplate, &caKey.PublicKey, caKey)
	require.NoError(t, err)
	_ = caCert // We use our own CA for signing.

	caCertForSign, err := x509.ParseCertificate(caDER)
	require.NoError(t, err)

	// Generate client key and cert.
	clientKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)

	clientTemplate := x509.Certificate{
		SerialNumber: big.NewInt(200),
		Subject:      pkix.Name{CommonName: "mongodb-client", Organization: []string{"TestOrg"}},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	clientDER, err := x509.CreateCertificate(rand.Reader, &clientTemplate, caCertForSign, &clientKey.PublicKey, caKey)
	require.NoError(t, err)

	certPEM = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: clientDER}))

	keyDER, err := x509.MarshalECPrivateKey(clientKey)
	require.NoError(t, err)
	keyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER}))

	return certPEM, keyPEM
}

func TestBuildClientOptions(t *testing.T) {
	validCACert := generateTestCACert(t)

	tests := []struct {
		name        string
		settings    DatasourceSettings
		wantErr     error
		checkOpts   func(t *testing.T, opts *options.ClientOptions)
	}{
		{
			name: "URI only, no auth, no TLS",
			settings: DatasourceSettings{
				URI: "mongodb://localhost:27017",
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				assert.Nil(t, opts.Auth)
				assert.Nil(t, opts.TLSConfig)
			},
		},
		{
			name: "SCRAM-SHA-256 with password",
			settings: DatasourceSettings{
				URI:           "mongodb://localhost:27017",
				AuthMechanism: "SCRAM-SHA-256",
				Password:      "secret",
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.Auth)
				assert.Equal(t, "SCRAM-SHA-256", opts.Auth.AuthMechanism)
				assert.Equal(t, "secret", opts.Auth.Password)
				assert.Equal(t, "admin", opts.Auth.AuthSource)
				assert.True(t, opts.Auth.PasswordSet)
			},
		},
		{
			name: "SCRAM-SHA-1 with password",
			settings: DatasourceSettings{
				URI:           "mongodb://localhost:27017",
				AuthMechanism: "SCRAM-SHA-1",
				Password:      "secret",
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.Auth)
				assert.Equal(t, "SCRAM-SHA-1", opts.Auth.AuthMechanism)
				assert.Equal(t, "secret", opts.Auth.Password)
				assert.Equal(t, "admin", opts.Auth.AuthSource)
				assert.True(t, opts.Auth.PasswordSet)
			},
		},
		{
			name: "MONGODB-X509 no password",
			settings: DatasourceSettings{
				URI:           "mongodb://localhost:27017",
				AuthMechanism: "MONGODB-X509",
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.Auth)
				assert.Equal(t, "MONGODB-X509", opts.Auth.AuthMechanism)
				assert.Equal(t, "$external", opts.Auth.AuthSource)
				assert.False(t, opts.Auth.PasswordSet)
			},
		},
		{
			name: "empty mechanism means no auth",
			settings: DatasourceSettings{
				URI: "mongodb://localhost:27017",
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				assert.Nil(t, opts.Auth)
			},
		},
		{
			name: "TLS enabled without CA cert",
			settings: DatasourceSettings{
				URI:        "mongodb://localhost:27017",
				TLSEnabled: true,
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.TLSConfig)
				assert.Nil(t, opts.TLSConfig.RootCAs)
			},
		},
		{
			name: "TLS with valid CA cert",
			settings: DatasourceSettings{
				URI:        "mongodb://localhost:27017",
				TLSEnabled: true,
				TLSCACert:  validCACert,
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.TLSConfig)
				assert.NotNil(t, opts.TLSConfig.RootCAs)
			},
		},
		{
			name: "TLS with invalid CA cert",
			settings: DatasourceSettings{
				URI:        "mongodb://localhost:27017",
				TLSEnabled: true,
				TLSCACert:  "not-a-valid-pem",
			},
			wantErr: ErrInvalidCACert,
		},
		{
			name: "SCRAM-SHA-256 combined with TLS",
			settings: DatasourceSettings{
				URI:           "mongodb://localhost:27017",
				AuthMechanism: "SCRAM-SHA-256",
				Password:      "secret",
				TLSEnabled:    true,
				TLSCACert:     validCACert,
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.Auth)
				assert.Equal(t, "SCRAM-SHA-256", opts.Auth.AuthMechanism)
				require.NotNil(t, opts.TLSConfig)
				assert.NotNil(t, opts.TLSConfig.RootCAs)
			},
		},
		{
			name: "SCRAM-SHA-256 with username",
			settings: DatasourceSettings{
				URI:           "mongodb://localhost:27017",
				AuthMechanism: "SCRAM-SHA-256",
				Username:      "myuser",
				Password:      "secret",
			},
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.Auth)
				assert.Equal(t, "myuser", opts.Auth.Username)
				assert.Equal(t, "admin", opts.Auth.AuthSource)
			},
		},
		{
			name: "X.509 with client cert",
			settings: func() DatasourceSettings {
				clientCert, clientKey := generateTestClientCert(t, validCACert)
				return DatasourceSettings{
					URI:           "mongodb://localhost:27017",
					AuthMechanism: "MONGODB-X509",
					TLSEnabled:    true,
					TLSCACert:     validCACert,
					TLSClientCert: clientCert,
					TLSClientKey:  clientKey,
				}
			}(),
			checkOpts: func(t *testing.T, opts *options.ClientOptions) {
				require.NotNil(t, opts.Auth)
				assert.Equal(t, "$external", opts.Auth.AuthSource)
				require.NotNil(t, opts.TLSConfig)
				assert.Len(t, opts.TLSConfig.Certificates, 1)
			},
		},
		{
			name: "invalid client cert returns error",
			settings: DatasourceSettings{
				URI:           "mongodb://localhost:27017",
				TLSEnabled:    true,
				TLSClientCert: "not-a-cert",
				TLSClientKey:  "not-a-key",
			},
			wantErr: ErrInvalidClientCert,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts, err := BuildClientOptions(tt.settings)
			if tt.wantErr != nil {
				require.Error(t, err)
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, opts)
			if tt.checkOpts != nil {
				tt.checkOpts(t, opts)
			}
		})
	}
}

func TestQueryData_MultipleQueries(t *testing.T) {
	client := &mockMongoClient{
		aggregateData: nil,
		aggregateErr:  nil,
	}

	ds := newDatasourceWithClient(DatasourceSettings{URI: "mongodb://localhost"}, client)

	req := &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				JSON:  []byte(`{"database":"db1","collection":"coll1","pipeline":"[{\"$limit\":5}]"}`),
			},
			{
				RefID: "B",
				JSON:  []byte(`{"database":"db2","collection":"coll2","pipeline":"[{\"$limit\":10}]"}`),
			},
		},
	}

	resp, err := ds.QueryData(context.Background(), req)
	require.NoError(t, err)
	assert.Len(t, resp.Responses, 2)
	assert.Contains(t, resp.Responses, "A")
	assert.Contains(t, resp.Responses, "B")
}
