/**
 * Plugin entry point for the MongoDB datasource.
 *
 * Registers the DataSource class and editor components with Grafana's plugin system.
 */
import { DataSourcePlugin } from '@grafana/data';

import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';
import { QueryEditor } from './components/QueryEditor/QueryEditor';
import { MongoDBQuery, MongoDBDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<DataSource, MongoDBQuery, MongoDBDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
