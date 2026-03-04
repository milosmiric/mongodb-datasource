# Configuration Guide

This guide covers all configuration options for the MongoDB datasource plugin.

## Connection Methods

### Connection URI (Recommended)

The simplest way to connect is with a single MongoDB connection string in the **Connection URI** field:

```
mongodb://username:password@host:port/database?authSource=admin
```

The URI is stored as an encrypted secret in Grafana — it will not appear in plaintext after saving.

#### Standalone

```
mongodb://myuser:mypassword@mongo-host:27017/mydb
```

#### Replica Set

```
mongodb://myuser:mypassword@host1:27017,host2:27017,host3:27017/mydb?replicaSet=rs0
```

#### Atlas (SRV)

For MongoDB Atlas or any SRV-based connection, enable the **Atlas (SRV)** toggle and use:

```
mongodb+srv://myuser:mypassword@cluster0.abc123.mongodb.net/mydb
```

SRV connections automatically handle DNS-based service discovery and TLS.

## Authentication

The plugin supports the following authentication mechanisms, selectable from the **Auth Mechanism** dropdown:

| Mechanism | When to Use |
|-----------|-------------|
| **None** | Local development, no-auth environments |
| **SCRAM-SHA-256** | Default for MongoDB 4.0+. Recommended for most deployments |
| **SCRAM-SHA-1** | Legacy authentication. Use only if your server requires it |
| **X.509** | Certificate-based authentication. No password field — auth uses TLS client certificates |

### Credentials in the URI

You can embed credentials directly in the connection URI:

```
mongodb://admin:s3cret@host:27017/mydb?authSource=admin
```

### Separate Password Field

Alternatively, if using an auth mechanism, enter the password in the dedicated **Password** field. This is also stored encrypted.

## TLS / SSL

Enable the **TLS Enabled** toggle to encrypt connections to MongoDB.

### Self-Signed Certificates

If your MongoDB server uses a self-signed or internal CA certificate, paste the PEM-encoded CA certificate into the **CA Certificate** text area:

```
-----BEGIN CERTIFICATE-----
MIIDxTCCAq2gAwIBAgIQAqxcJmoLQ...
-----END CERTIFICATE-----
```

### Atlas / Cloud Providers

Atlas connections (SRV) already include TLS by default. You typically don't need to enable the TLS toggle or provide a CA certificate for Atlas.

## Default Database

The **Default Database** field sets which database is pre-selected in the query editor's database dropdown. This is a convenience setting — you can always select a different database per query.

## Provisioning

You can provision the datasource via YAML for automated deployments. Place this in your Grafana provisioning directory (`/etc/grafana/provisioning/datasources/`):

```yaml
apiVersion: 1

datasources:
  - name: MongoDB
    type: milosmiric-mongodb-datasource
    access: proxy
    isDefault: true
    uid: mongodb-prod
    editable: true
    secureJsonData:
      uri: "mongodb://user:password@mongo-host:27017/mydb?replicaSet=rs0"
    jsonData:
      database: "mydb"
      tlsEnabled: false
      isSrv: false
      authMechanism: ""
```

### Available `jsonData` Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `database` | string | `""` | Default database name |
| `isSrv` | boolean | `false` | Use MongoDB+SRV protocol |
| `tlsEnabled` | boolean | `false` | Enable TLS encryption |
| `tlsCaCert` | string | `""` | PEM-encoded CA certificate |
| `authMechanism` | string | `""` | Auth mechanism: `""`, `SCRAM-SHA-256`, `SCRAM-SHA-1`, `MONGODB-X509` |

### Available `secureJsonData` Fields

| Field | Type | Description |
|-------|------|-------------|
| `uri` | string | MongoDB connection string (encrypted) |
| `password` | string | MongoDB password (encrypted) |

## Health Check

After configuring the datasource, click **Save & test**. A successful connection returns:

```
MongoDB connected. Server version: 8.0.10. Replica set: rs0
```

If the connection fails, check:

1. Network connectivity between Grafana and MongoDB
2. Firewall rules allowing the MongoDB port
3. Authentication credentials
4. TLS certificate validity
5. Grafana server logs for detailed error messages
