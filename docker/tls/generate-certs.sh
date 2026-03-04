#!/bin/sh
# Generate TLS certificates for MongoDB dev environment.
# Outputs to /certs/ directory. Idempotent — skips if certs already exist.

set -e

CERT_DIR="/certs"

if [ -f "$CERT_DIR/ca.pem" ] && [ -f "$CERT_DIR/server-bundle.pem" ] && [ -f "$CERT_DIR/client.pem" ]; then
  echo "Certificates already exist, skipping generation."
  exit 0
fi

mkdir -p "$CERT_DIR"

echo "Generating CA certificate..."
openssl ecparam -genkey -name prime256v1 -noout -out "$CERT_DIR/ca-key.pem"
openssl req -new -x509 -key "$CERT_DIR/ca-key.pem" -out "$CERT_DIR/ca.pem" \
  -days 3650 -subj "/CN=Test CA"

echo "Generating server certificate..."
openssl ecparam -genkey -name prime256v1 -noout -out "$CERT_DIR/server-key.pem"
openssl req -new -key "$CERT_DIR/server-key.pem" -out "$CERT_DIR/server.csr" \
  -subj "/CN=mongodb"

cat > "$CERT_DIR/server-ext.cnf" <<EOF
subjectAltName = DNS:mongodb,DNS:localhost
EOF

openssl x509 -req -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca-key.pem" -CAcreateserial \
  -out "$CERT_DIR/server.pem" -days 3650 \
  -extfile "$CERT_DIR/server-ext.cnf"

# MongoDB requires cert+key concatenated in one file.
cat "$CERT_DIR/server.pem" "$CERT_DIR/server-key.pem" > "$CERT_DIR/server-bundle.pem"

echo "Generating client certificate..."
openssl ecparam -genkey -name prime256v1 -noout -out "$CERT_DIR/client-key.pem"
openssl req -new -key "$CERT_DIR/client-key.pem" -out "$CERT_DIR/client.csr" \
  -subj "/CN=mongodb-client/O=TestOrg"
openssl x509 -req -in "$CERT_DIR/client.csr" \
  -CA "$CERT_DIR/ca.pem" -CAkey "$CERT_DIR/ca-key.pem" -CAcreateserial \
  -out "$CERT_DIR/client.pem" -days 3650

# Clean up CSRs and temp files.
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.cnf "$CERT_DIR"/*.srl

# Ensure readable by all containers.
chmod 644 "$CERT_DIR"/*.pem

echo "Certificate generation complete."
