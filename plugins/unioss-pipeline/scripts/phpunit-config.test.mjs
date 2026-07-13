import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDatabasePhp, applyStartedSubscriber, applyConfigPhp, applyPhpunitXml,
} from './phpunit-config.mjs';

const CREDS = { mysql: 'mysql-unioss3', user: 'root', pass: 'ProotW' };

test('applyDatabasePhp rewrites hostname/username/password to config values', () => {
  const base = [
    "$db['default'] = array(",
    "\t'dsn'\t=> '',",
    "\t'hostname' => $_SERVER['DEV_MYSQL_HOST'] ?? '127.0.0.1',",
    "\t'username' => $_SERVER['DEV_MYSQL_USER'] ?? 'unioss',",
    "\t'password' => $_SERVER['DEV_MYSQL_PASS'] ?? 'testPassWord',",
    "\t'database' => 'testing_DB',",
    ');',
  ].join('\n');
  const out = applyDatabasePhp(base, CREDS);
  assert.match(out, /'hostname' => 'mysql-unioss3',/);
  assert.match(out, /'username' => 'root',/);
  assert.match(out, /'password' => 'ProotW',/);
  assert.match(out, /'database' => 'testing_DB',/); // untouched
});

test('applyDatabasePhp is idempotent', () => {
  const base = "\t'hostname' => '127.0.0.1',\n\t'username' => 'x',\n\t'password' => 'y',";
  const once = applyDatabasePhp(base, CREDS);
  assert.equal(applyDatabasePhp(once, CREDS), once);
});

test('applyStartedSubscriber (skipImport) comments the exec line with config creds', () => {
  const base = '        exec("mysql $mysql_host -u $username -p$password < " . $db_dump_dir, $output, $retval);';
  const out = applyStartedSubscriber(base, { ...CREDS, skipImport: true });
  assert.match(out, /^\s*\/\/ exec\('mysql --ssl=0 -hmysql-unioss3 -P3306 -uroot -pProotW < ' \. \$db_dump_dir, \$output, \$retval\);/m);
});

test('applyStartedSubscriber (import) leaves the exec line active', () => {
  const base = "        // exec('mysql --ssl=0 -hmysql-unioss3 -P3306 -uroot -pProotW < ' . $db_dump_dir, $output, $retval);";
  const out = applyStartedSubscriber(base, { ...CREDS, skipImport: false });
  assert.match(out, /^\s*exec\('mysql --ssl=0 -hmysql-unioss3 -P3306 -uroot -pProotW < ' \. \$db_dump_dir, \$output, \$retval\);/m);
  assert.ok(!/\/\/ exec\(/.test(out));
});

test('applyConfigPhp adds HTTP_HOST before base_url and composer_autoload once', () => {
  const base = [
    '$config[\'base_url\'] = $http_or_https . \'://\'.$_SERVER["HTTP_HOST"];',
    '$config[\'log_path\'] = APPPATH.\'logs/testing/\';',
  ].join('\n');
  const out = applyConfigPhp(base);
  assert.match(out, /\$_SERVER\["HTTP_HOST"\] = 'localhost:2380\/admin';\n\$config\['base_url'\]/);
  assert.match(out, /\$config\['composer_autoload'\] = realpath\(APPPATH \. '\.\.\/\.\.\/my-vendor\/vendor\/autoload\.php'\);/);
  assert.equal(applyConfigPhp(out), out); // idempotent
});

test('applyPhpunitXml replaces the <php> block with the testing env', () => {
  const base = "<logging></logging>\n\t<php>\n        <server name='HTTP_HOST' value='192.168.56.10' />\n\t\t<ini name=\"memory_limit\" value=\"2048M\"/>\n    </php>\n\t<!-- x -->";
  const out = applyPhpunitXml(base);
  assert.match(out, /<server name='CI_ENV' value='testing' \/>/);
  assert.match(out, /<env name="ENVIRONMENT" value="testing" \/>/);
  assert.match(out, /<server name='HTTP_HOST' value='127\.0\.0\.1' \/>/);
  assert.equal((out.match(/<php>/g) || []).length, 1);
});
