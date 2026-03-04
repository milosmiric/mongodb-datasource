/**
 * MongoDB DataSource class for Grafana.
 *
 * Extends DataSourceWithBackend to proxy all query and health check
 * calls to the Go backend plugin via gRPC.
 */
import { CoreApp, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { MongoDBDataSourceOptions, MongoDBQuery, DEFAULT_QUERY } from './types';

/** DataSource handles communication between Grafana and the MongoDB backend plugin. */
export class DataSource extends DataSourceWithBackend<MongoDBQuery, MongoDBDataSourceOptions> {
  constructor(instanceSettings: DataSourceInstanceSettings<MongoDBDataSourceOptions>) {
    super(instanceSettings);
  }

  /** getDefaultQuery returns default values for new queries. */
  getDefaultQuery(_: CoreApp): Partial<MongoDBQuery> {
    return DEFAULT_QUERY;
  }

  /**
   * applyTemplateVariables replaces Grafana template variables in the query
   * before sending it to the backend.
   */
  applyTemplateVariables(query: MongoDBQuery, scopedVars: Record<string, { text: string; value: string }>): MongoDBQuery {
    const templateSrv = getTemplateSrv();
    return {
      ...query,
      database: templateSrv.replace(query.database, scopedVars),
      collection: templateSrv.replace(query.collection, scopedVars),
      pipeline: templateSrv.replace(query.pipeline, scopedVars),
      timeField: templateSrv.replace(query.timeField, scopedVars),
      legendFormat: templateSrv.replace(query.legendFormat, scopedVars),
    };
  }
}
