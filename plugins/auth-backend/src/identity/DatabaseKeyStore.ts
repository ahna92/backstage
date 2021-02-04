/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Knex from 'knex';
import { resolvePackagePath } from '@backstage/backend-common';
import { AnyJWK, KeyStore, StoredKey } from './types';
import { DateTime } from 'luxon';

const migrationsDir = resolvePackagePath(
  '@backstage/plugin-auth-backend',
  'migrations',
);

const TABLE = 'signing_keys';

type Row = {
  created_at: Date; // row.created_at is a string after being returned from the database
  kid: string;
  key: string;
};

type Options = {
  database: Knex;
};

export class DatabaseKeyStore implements KeyStore {
  static async create(options: Options): Promise<DatabaseKeyStore> {
    const { database } = options;

    await database.migrate.latest({
      directory: migrationsDir,
    });

    return new DatabaseKeyStore(options);
  }

  private readonly database: Knex;

  private constructor(options: Options) {
    this.database = options.database;
  }

  async addKey(key: AnyJWK): Promise<void> {
    await this.database<Row>(TABLE).insert({
      kid: key.kid,
      key: JSON.stringify(key),
    });
  }

  async listKeys(): Promise<{ items: StoredKey[] }> {
    const rows = await this.database<Row>(TABLE).select();

    return {
      items: rows.map(row => ({
        key: JSON.parse(row.key),
        createdAt: DateTime.fromFormat(
          (row.created_at as unknown) as string,
          'yyyy-MM-dd HH:mm:ss',
          {
            zone: 'UTC',
          },
        ),
      })),
    };
  }

  async removeKeys(kids: string[]): Promise<void> {
    await this.database(TABLE).delete().whereIn('kid', kids);
  }
}
