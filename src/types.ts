/**
 * Type definitions for the MongoDB datasource plugin.
 *
 * Defines query models, datasource options, and API response types used
 * throughout the frontend components and hooks.
 */
import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

/** QueryFormatType specifies the output format for query results. */
export type QueryFormatType = 'table' | 'time_series';

/** MongoDBQuery represents a query configuration sent to the backend. */
export interface MongoDBQuery extends DataQuery {
  /** The MongoDB database to query. */
  database: string;
  /** The MongoDB collection to query. */
  collection: string;
  /** The raw JSON aggregation pipeline. */
  pipeline: string;
  /** The document field to use as the time axis in time-series mode. */
  timeField: string;
  /** The output format: table or time_series. */
  format: QueryFormatType;
  /** Optional Go template string for time-series legend labels. */
  legendFormat: string;
}

/** Default values for a new query. */
export const DEFAULT_QUERY: Partial<MongoDBQuery> = {
  database: '',
  collection: '',
  pipeline: '[{"$limit": 100}]',
  timeField: '',
  format: 'table',
  legendFormat: '',
};

/** VariableEditorMode selects how a dashboard variable query is authored. */
export type VariableEditorMode = 'builder' | 'raw';

/**
 * MongoDBVariableQuery represents a dashboard template-variable query.
 *
 * In `builder` mode the options come from the distinct values of `field` in
 * `collection`. In `raw` mode the user supplies an aggregation `pipeline` that
 * returns either `__text`/`__value` columns or a single column.
 */
export interface MongoDBVariableQuery extends DataQuery {
  /** Whether the query is authored via the guided builder or a raw pipeline. */
  mode: VariableEditorMode;
  /** The MongoDB database to query. */
  database: string;
  /** The MongoDB collection to query. */
  collection: string;
  /** The field whose distinct values populate the variable (builder mode). */
  field: string;
  /** The raw JSON aggregation pipeline (raw mode). */
  pipeline: string;
}

/** Default values for a new variable query. */
export const DEFAULT_VARIABLE_QUERY: Partial<MongoDBVariableQuery> = {
  mode: 'builder',
  database: '',
  collection: '',
  field: '',
  pipeline: '',
};

/** MongoDBDataSourceOptions holds the JSON configuration for the datasource. */
export interface MongoDBDataSourceOptions extends DataSourceJsonData {
  /** The MongoDB connection string URI. */
  uri?: string;
  /** The default database name. */
  database?: string;
  /** Whether the connection uses MongoDB+SRV protocol (Atlas). */
  isSrv?: boolean;
  /** Whether TLS is enabled for the connection. */
  tlsEnabled?: boolean;
  /** The PEM-encoded CA certificate for TLS connections. */
  tlsCaCert?: string;
  /** The authentication mechanism. */
  authMechanism?: AuthMechanism;
  /** The MongoDB username for SCRAM authentication. */
  username?: string;
}

/** AuthMechanism enumerates supported MongoDB authentication mechanisms. */
export type AuthMechanism = '' | 'SCRAM-SHA-256' | 'SCRAM-SHA-1' | 'MONGODB-X509';

/** MongoDBSecureJsonData holds encrypted configuration fields. */
export interface MongoDBSecureJsonData {
  /** The MongoDB connection URI (when stored securely). */
  uri?: string;
  /** The MongoDB password. */
  password?: string;
  /** The PEM-encoded client certificate for X.509 auth. */
  tlsClientCert?: string;
  /** The PEM-encoded client private key for X.509 auth. */
  tlsClientKey?: string;
}

/** DatabaseListResponse is the API response from the /databases resource endpoint. */
export type DatabaseListResponse = string[];

/** CollectionListResponse is the API response from the /collections resource endpoint. */
export type CollectionListResponse = string[];
